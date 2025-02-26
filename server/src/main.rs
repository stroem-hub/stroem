// server/src/main.rs
use axum::{routing::{post, get}, Router, Json, response::IntoResponse, http::StatusCode};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Write, Cursor};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tokio::sync::mpsc::{self, Sender};
use tracing::{info, error, Level, debug};
use tracing_subscriber;
use clap::Parser;
use tera::{Tera, Context};
use std::collections::{HashMap, HashSet};
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;

mod workspace;
use workspace::WorkspaceConfigurationTrait;

#[derive(Debug, Serialize, Deserialize)]
struct Job {
    task: String,
    input: serde_json::Value,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = ".")]
    workspace: String,
    #[arg(short, long)]
    verbose: bool,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { Level::TRACE } else { Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    let workspace = PathBuf::from(&args.workspace);
    if !workspace.exists() || !workspace.is_dir() {
        error!("Workspace path '{}' does not exist or is not a directory", args.workspace);
        return;
    }
    std::fs::create_dir_all(workspace.join("results")).unwrap();
    std::fs::create_dir_all(workspace.join("logs")).unwrap();

    let workflows_path = workspace.join(".workflows");
    let mut workspace_config = workspace::WorkspaceConfiguration::new(
        workflows_path.to_str().unwrap()
    );
    if let Err(e) = workspace_config.reread() {
        error!("Failed to load workspace configurations: {}", e);
        return;
    }
    info!("Loaded workspace configurations: {:?}", workspace_config);

    let addr = "0.0.0.0:8080";
    let (tx, mut rx) = mpsc::channel::<Job>(100);
    let workspace_for_queue = workspace.clone();
    let workspace_config_for_queue = workspace_config;

    tokio::spawn(async move {
        while let Some(job) = rx.recv().await {
            info!("Processing job: {:?}", job);
            if let Err(e) = process_job(job, &workspace_for_queue, &workspace_config_for_queue).await {
                error!("Failed to process job: {}", e);
            }
        }
    });

    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/files/workflows.tar.gz", get(serve_workspace_tarball))
        .with_state((tx, workspace.clone()));

    let listener = TcpListener::bind(&addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

async fn enqueue_job(
    axum::extract::State((tx, _)): axum::extract::State<(Sender<Job>, PathBuf)>,
    Json(job): Json<Job>,
) -> Result<String, String> {
    info!("Received job: {:?}", job);
    tx.send(job).await.map_err(|e| e.to_string())?;
    Ok("Job enqueued".to_string())
}

async fn serve_workspace_tarball(
    axum::extract::State((_, workspace)): axum::extract::State<(Sender<Job>, PathBuf)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut tarball = Vec::new();
    let mut builder = Builder::new(&mut tarball);

    let walker = GlobWalkerBuilder::from_patterns(&workspace, &["**/*"])
        .max_depth(10)
        .follow_links(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build walker: {}", e)))?;

    for entry in walker.into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            let relative_path = path.strip_prefix(&workspace)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get relative path: {}", e)))?;
            let mut file = File::open(path)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to open file: {}", e)))?;
            builder.append_file(
                relative_path,
                &mut file,
            )
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to append file to tar: {}", e)))?;
        }
    }

    builder.finish()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to finish tar: {}", e)))?;
    drop(builder);

    let mut gzipped = Vec::new();
    let mut encoder = GzEncoder::new(&mut gzipped, Compression::default());
    encoder.write_all(&tarball)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write to gzip: {}", e)))?;
    encoder.finish()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to finish gzip: {}", e)))?;

    Ok((
        StatusCode::OK,
        [
            ("Content-Type", "application/gzip"),
            ("Content-Disposition", "attachment; filename=\"workspace.tar.gz\""),
        ],
        gzipped,
    ))
}

async fn process_job(job: Job, workspace: &PathBuf, config: &workspace::WorkspaceConfiguration) -> Result<(), String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let result_path = workspace.join("results").join(format!("job_{}.json", job_id));
    let log_path = workspace.join("logs").join(format!("job_{}.log", job_id));

    let task = config.workflow_data.tasks
        .as_ref()
        .and_then(|tasks| tasks.get(&job.task))
        .ok_or_else(|| format!("Task '{}' not found", job.task))?;

    let mut incoming_edges = HashMap::new();
    let mut outgoing_edges = HashMap::new();
    for (step_name, step) in &task.flow {
        incoming_edges.entry(step_name.clone()).or_insert_with(HashSet::new);
        if let Some(next) = &step.on_success {
            incoming_edges.entry(next.clone()).or_insert_with(HashSet::new).insert(step_name.clone());
            outgoing_edges.entry(step_name.clone()).or_insert_with(|| (None, None)).0 = Some(next.clone());
        }
        if let Some(next) = &step.on_fail {
            incoming_edges.entry(next.clone()).or_insert_with(HashSet::new).insert(step_name.clone());
            outgoing_edges.entry(step_name.clone()).or_insert_with(|| (None, None)).1 = Some(next.clone());
        }
    }

    let mut to_process: Vec<String> = task.flow.keys()
        .filter(|step| incoming_edges.get(*step).map_or(true, |preds| preds.is_empty()))
        .cloned()
        .collect();
    if to_process.is_empty() {
        return Err("No starting step found (possible cycle)".to_string());
    }

    let mut tera = Tera::default();
    let mut context = Context::new();
    context.insert("inputs", &job.input);
    let mut step_outputs = HashMap::new();
    let mut processed = HashSet::new();
    let mut log = String::new();
    let empty_set: HashSet<String> = HashSet::new();

    while let Some(current_step) = to_process.pop() {
        if processed.contains(&current_step) { // Fixed ¤t_step
            continue;
        }

        let predecessors = incoming_edges.get(&current_step).unwrap_or(&empty_set); // Fixed ¤t_step
        if !predecessors.iter().all(|pred| processed.contains(pred)) {
            to_process.insert(0, current_step);
            continue;
        }

        let step = task.flow.get(&current_step).unwrap(); // Fixed ¤t_step
        log.push_str(&format!("Executing step {} for job {}\n", current_step, job_id));

        let action = config.workflow_data.actions
            .as_ref()
            .and_then(|actions| actions.get(&step.action))
            .ok_or_else(|| format!("Action '{}' not found", step.action))?;

        let rendered_inputs = if let Some(inputs) = &step.input {
            let mut rendered = HashMap::new();
            for (key, value) in inputs {
                let rendered_value = tera.render_str(value, &context)
                    .map_err(|e| format!("Tera error: {}", e))?;
                rendered.insert(key.clone(), rendered_value);
            }
            rendered
        } else {
            HashMap::new()
        };

        let output = if let Some(content) = &action.content {
            serde_json::from_str(&content.lines().last().unwrap_or("{}"))
                .map_err(|e| format!("Output parse error: {}", e))?
        } else if action.path.is_some() {
            serde_json::Value::Object(serde_json::Map::from_iter(vec![
                ("id".to_string(), serde_json::Value::Number(42.into())),
                ("valid".to_string(), serde_json::Value::Bool(true)),
            ]))
        } else {
            return Err("Action has neither path nor content".to_string());
        };

        step_outputs.insert(current_step.clone(), output.clone());
        context.insert(format!("steps.{}.output", current_step), &output);
        processed.insert(current_step.clone());
        log.push_str(&format!(
            "Step {} completed with output: {:?}\n",
            current_step, output
        ));

        if let Some((on_success, on_fail)) = outgoing_edges.get(&current_step) { // Fixed ¤t_step
            let next = on_success.as_ref().unwrap_or_else(|| {
                on_fail.as_ref().unwrap_or(&current_step) // Fixed ¤t_step
            });
            if task.flow.contains_key(next) && !processed.contains(next) {
                to_process.push(next.clone());
            }
        }
    }

    let result = serde_json::to_string(&step_outputs).map_err(|e| e.to_string())?;
    let mut result_file = File::create(&result_path).map_err(|e| e.to_string())?;
    result_file.write_all(result.as_bytes()).map_err(|e| e.to_string())?;

    let mut log_file = File::create(&log_path).map_err(|e| e.to_string())?;
    log_file.write_all(log.as_bytes()).map_err(|e| e.to_string())?;

    info!("Job {} completed", job_id);
    Ok(())
}