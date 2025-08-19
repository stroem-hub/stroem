# Project Structure

## Workspace Organization
This is a Rust workspace with multiple crates organized by functionality:

```
├── common/          # Shared libraries and utilities
├── server/          # Main orchestration server
├── worker/          # Distributed task execution nodes  
├── runner/          # Local task runner
├── cli/             # Command-line interface
└── ui/              # SvelteKit frontend application
```

## Core Crates

### `common/`
Shared functionality across all components:
- `action/` - Task action implementations (shell, etc.)
- `dag_walker.rs` - Dependency graph traversal
- `log_collector.rs` - Log aggregation utilities
- `parameter_renderer.rs` - Template parameter rendering
- `runner.rs` - Core task execution logic
- `workflows_configuration.rs` - Workflow config parsing
- `workspace_client.rs` - Workspace interaction layer

### `server/`
Central orchestration engine:
- `auth/` - Authentication providers (internal, OIDC)
- `repository/` - Database access layer (jobs, logs)
- `web/` - HTTP API and WebSocket handlers
- `workspace_source/` - Workspace backends (folder, git)
- `migrations/` - Database schema migrations
- `static/` - Embedded frontend assets

### `worker/`
Distributed execution nodes:
- `runner_local.rs` - Local task execution implementation

### `ui/`
SvelteKit frontend:
- `src/lib/` - Shared components and utilities
- `src/routes/` - Page components and API routes
- `static/` - Static assets

## Configuration & Data

### `files/`
Runtime data and configuration:
- `server-config.yaml` - Production server configuration
- `server-config.dev.yaml` - Development server configuration
- `workspace/` - Default workspace folder
- `logs/` - Task execution logs
- `logs-cache/` - Compressed log archives

### `data/`
PostgreSQL data directory (Docker volume mount)

## Development Files
- `docker-compose.yml` - Local development environment
- `Dockerfile.server` / `Dockerfile.worker` - Container definitions
- `zellij_layout.kdl` - Development session layout
- `run.sh` - Development startup script

## Workflow Configuration
Workflows are defined in `.workflows/` directories within workspaces:
- `config.yaml` - Main workflow definitions
- Actions, tasks, triggers, and resource definitions
- Support for multiple config files that are merged

## Key Patterns
- **Workspace-based**: All crates follow Cargo workspace conventions
- **Async-first**: Heavy use of Tokio async patterns throughout
- **Configuration-driven**: YAML-based configuration for flexibility
- **Microservices**: Clear separation between server, worker, and CLI components
- **Database migrations**: Automatic schema management via SQLx migrations