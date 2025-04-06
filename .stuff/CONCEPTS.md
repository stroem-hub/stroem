
# Workflow Engine: Main Concepts

This document outlines the core concepts of the Workflow Engine project.

## 1. Workspace
- **Definition**: A directory containing workflow definitions in `.workflows/*.yaml`, synced between server and runners.
- **Revision**: A BLAKE2b hash of folder contents (files and paths), used to track changes.
- **Sync**: Runners download tarballs from the server, locked per process via `.workspace.lock` to prevent concurrent updates.
- **Configuration**: Parsed into `WorkspaceConfiguration` from YAML files, holding triggers, tasks, and actions.

## 2. Jobs
- **Structure**: Defined by `Job` (task/action, input, UUID), enqueued via API or triggers.
- **Execution**: Workers poll jobs and spawn runners; runners execute tasks or actions using the workspace.
- **Result**: `JobResult` includes `worker_id`, `job_id`, `exit_success`, `logs`, timestamps, and `revision`.

## 3. Tasks and Actions
- **Tasks**: Multi-step workflows with a `flow` (DAG of steps), executed by runners.
- **Actions**: Single executable commands (e.g., SSH), templated with Tera using task/step inputs and outputs.
- **Outputs**: Actions can output JSON via `OUTPUT:` lines, stored in `JobResult.output`.

## 4. Concurrency
- **Workers**: Spawn multiple runners (controlled by `--max-runners`), each a separate process.
- **Synchronization**: File locking (`fs2`) ensures only one runner syncs the workspace at a time.

## 5. Storage (Planned)
- **Current**: Logs and results are console-only via `tracing`.
- **Future**: Options include SQLite (local, queryable), PostgreSQL (scalable), or file-based (simple).

## 6. Revision Tracking
- **Mechanism**: BLAKE2b hash of workspace folder contents, stored in `workspace.rev`.
- **Sync Logic**: Runners use HEAD requests to compare revisions, downloading only on mismatch.

## 7. Future Git Integration
- **Goal**: Replace folder hashing with Git commit hashes.
- **Watcher**: Adapt `notify` to poll Git status or use Git APIs.