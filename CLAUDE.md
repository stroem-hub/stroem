# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strøm is a high-performance orchestration and automation platform designed as the backbone for infrastructure operations. It powers scheduled tasks, CI/CD workflows, ETL pipelines, and system operations through a unified execution model.

**Status**: Early development - APIs and architecture are unstable and subject to change.

## Architecture

The system follows a distributed architecture with these core components:

### Rust Workspace Components
- **server/** - Main orchestration server with web API, scheduler, workspace management, and authentication
- **worker/** - Job execution workers that poll for tasks and run them using local runners  
- **runner/** - Task execution engine that handles the actual workflow step execution
- **cli/** - Command-line interface for config validation and task management
- **common/** - Shared types, utilities, and data structures across components

### Frontend
- **ui/** - SvelteKit-based web interface with TailwindCSS for job monitoring and management

### Key Concepts
- **Workspace**: Git or folder-based configuration source containing workflow definitions
- **Jobs**: Individual workflow executions with input/output data and execution state
- **Tasks**: Atomic workflow steps that can depend on other tasks
- **Workers**: Distributed execution nodes that poll for and execute jobs
- **Scheduler**: Central component that manages job queuing and execution coordination

## Development Commands

### Rust Backend
```bash
# Build all workspace members
cargo build

# Run server (requires PostgreSQL and config file)
cargo run --bin server -- --config files/server-config.dev.yaml

# Run worker (requires server to be running)
cargo run --bin worker -- --server http://localhost:8080 --token secrettokenstring

# Run CLI for config validation
cargo run --bin cli -- validate --config path/to/config.yaml

# Run tests
cargo test
```

### UI Frontend
```bash
cd ui/

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint and format
npm run lint
npm run format

# Type checking
npm run check
```

## Configuration

### Server Configuration
The server requires a YAML configuration file (see `files/server-config.yaml` for example):
- Database connection (PostgreSQL)
- Workspace configuration (Git or local folder)
- Authentication settings (internal, OIDC)
- Log storage (local filesystem or S3)
- Worker authentication token

### Database Setup
The server uses PostgreSQL with SQLx for migrations. Migrations are embedded and run automatically on startup.

### Development Database
```bash
# For local development, ensure PostgreSQL is running with:
# Database: workflow
# User: workflow  
# Password: workflow
# Host: localhost:5432
```

## Key Implementation Details

### Authentication System
- JWT-based authentication with refresh tokens
- Support for internal (email/password) and OIDC providers
- Initial admin user created automatically from config
- Worker authentication via bearer tokens

### Job Execution Flow
1. Server reads workflow definitions from workspace
2. Scheduler creates jobs from workflows based on triggers/schedules
3. Workers poll `/jobs/next` endpoint for available jobs
4. Workers execute jobs using local runners
5. Results are posted back to `/jobs/{id}/results` endpoint
6. Logs are streamed in real-time via LogCollector

### Workspace Management
- Supports Git repositories or local folders
- File watching for automatic config reloading
- Workspace changes trigger workflow re-evaluation
- Template engine (Tera) for parameterized configurations

### UI Component Structure
- Atomic design pattern: atoms/ molecules/ organisms/ pages/
- SvelteKit with TypeScript
- TailwindCSS for styling
- Chart.js for metrics visualization
- Testing with Vitest and Testing Library

## Lint and Type Checking

After making changes, always run:
```bash
# Rust
cargo clippy
cargo fmt --check

# UI
cd ui/
npm run lint
npm run check
```

## Testing

```bash
# Rust tests
cargo test

# UI tests  
cd ui/
npm run test
```