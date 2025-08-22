use std::fs;
use std::io;
use std::path::Path;
use std::process::Command;

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn main() {
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=Cargo.lock");

    // Tell Cargo to rerun this script if the UI source changes
    println!("cargo:rerun-if-changed=../ui/src");
    println!("cargo:rerun-if-changed=../ui/svelte.config.js");
    println!("cargo:rerun-if-changed=../ui/package.json");

    // Clean directories for a fresh build
    let static_dir = Path::new("static");
    let ui_build_dir = Path::new("../ui/build");

    // Clean static directory
    if static_dir.exists() {
        fs::remove_dir_all(static_dir).expect("Failed to remove old static directory");
    }
    fs::create_dir(static_dir).expect("Failed to create static directory");

    // Clean UI build directory
    if ui_build_dir.exists() {
        fs::remove_dir_all(ui_build_dir).expect("Failed to remove old UI build directory");
        println!("Cleaned UI build directory");
    }

    // Build the SvelteKit UI
    println!("Building the UI");
    let ui_build = Command::new("pnpm")
        .arg("build")
        .current_dir("../ui")
        .status()
        .expect("Failed to execute pnpm build");

    if !ui_build.success() {
        panic!("SvelteKit UI build failed");
    }

    // Copy UI build output to static directory
    if ui_build_dir.exists() {
        copy_dir_all(ui_build_dir, static_dir)
            .expect("Failed to copy UI build to static directory");
        println!("{:?} copied to {:?}", &ui_build_dir, &static_dir);
    } else {
        println!("Warning: UI build directory not found at ../ui/build");
    }

    // println!("cargo:rerun-if-changed=static");
}
