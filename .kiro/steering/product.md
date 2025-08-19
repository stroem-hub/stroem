# Product Overview

**Strøm** is a high-performance orchestration and automation platform designed as infrastructure backbone for scheduled tasks, CI/CD workflows, ETL pipelines, and system operations.

## Core Components
- **Server**: Central orchestration engine with web UI and API
- **Worker**: Distributed execution nodes for running tasks
- **CLI**: Command-line interface for management and operations
- **Runner**: Local task execution engine

## Key Features
- Workflow orchestration with DAG-based task dependencies
- Scheduled task execution via cron triggers
- Multi-workspace support (folder-based or git-based)
- Authentication with internal and OIDC providers
- Real-time log streaming and caching
- Resource management and templating system

## Current Status
⚠️ **Early Development** - APIs, configuration formats, and architecture are unstable and subject to change.

## Architecture
- Microservices architecture with server/worker separation
- PostgreSQL for persistence
- WebSocket-based real-time communication
- Docker containerization support
- Extensible through plugins and adapters