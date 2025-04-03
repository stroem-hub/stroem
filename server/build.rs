use std::process::Command;
use std::path::Path;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=migrations");

    /*
    // Tell Cargo to rerun this script if the UI source changes
    println!("cargo:rerun-if-changed=../ui/src");
    println!("cargo:rerun-if-changed=../ui/svelte.config.js");
    println!("cargo:rerun-if-changed=../ui/package.json");

    // Ensure the static directory exists
    let static_dir = Path::new("static");
    if static_dir.exists() {
        fs::remove_dir_all(static_dir).expect("Failed to remove old static directory");
    }
    fs::create_dir(static_dir).expect("Failed to create static directory");

    // Build the SvelteKit UI
    let ui_build = Command::new("npm")
        .arg("run")
        .arg("build")
        .current_dir("../ui")
        .status()
        .expect("Failed to execute npm run build");

    if !ui_build.success() {
        panic!("SvelteKit UI build failed");
    }
    // println!("cargo:rerun-if-changed=static");

     */

}