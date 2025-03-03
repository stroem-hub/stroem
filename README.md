# Workflow Engine

A distributed task execution system built in Rust, designed to manage and execute workflows defined in YAML files. The system consists of three main components: a server, a worker, and a runner, with a shared common library.

## Overview

The Workflow Engine enables users to define tasks and actions in a `.workflows` directory within a workspace, trigger them via cron schedules or API calls, and execute them concurrently across multiple runners. It supports workspace synchronization, result logging, and revision tracking, with plans for future Git integration.

### Components

- **workflow-server**: Manages job queues, serves workspace tarballs, and receives job results.
    - Listens on `0.0.0.0:8080` by default.
    - Watches the workspace for changes and caches tarballs with revisions.
- **workflow-worker**: Polls jobs from the server and spawns runners (up to `--max-runners`, default 5).
- **workflow-runner**: Executes individual jobs, syncing the workspace from the server if needed.
- **common**: Shared library with structs (e.g., `Job`, `JobResult`, `Workspace`) and utilities.

## Features

- **Workflow Definition**: YAML-based configuration for triggers, tasks, and actions.
- **Concurrent Execution**: Multiple runners execute jobs in parallel, controlled by `--max-runners`.
- **Workspace Sync**: Runners download and unpack tarballs from the server, locked per process to avoid conflicts.
- **Revision Tracking**: Uses BLAKE2b hashing of workspace contents for versioning.
- **Logging**: Job results and logs are currently logged to console; persistent storage TBD.

## Usage

1. **Build**:
   ```bash
   cd workflow-engine
   cargo build --all
   cp target/debug/workflow-server target/debug/workflow-worker /path/to/workspace/