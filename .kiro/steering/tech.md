# Technology Stack

## Backend (Rust)
- **Language**: Rust (Edition 2024)
- **Web Framework**: Axum 0.8.4 with WebSocket support
- **Database**: PostgreSQL with SQLx for async queries
- **Authentication**: JWT + HMAC, OIDC support via OpenID
- **Async Runtime**: Tokio with full features
- **Serialization**: Serde for JSON handling
- **Templating**: Tera for configuration templating
- **Scheduling**: Cron expressions for task triggers
- **Logging**: Tracing with subscriber formatting
- **File Operations**: Tar/Gzip compression, async file handling
- **Git Integration**: git2 for repository operations
- **Cloud Storage**: AWS S3 SDK support

## Frontend (SvelteKit)
- **Framework**: SvelteKit with TypeScript
- **UI Library**: Flowbite Svelte components
- **Styling**: TailwindCSS 4.x
- **Build Tool**: Vite
- **Linting**: ESLint + Prettier
- **Adapter**: Static adapter for deployment

## Infrastructure
- **Database**: PostgreSQL 17 Alpine
- **Containerization**: Docker with multi-stage builds

## Common Commands

### Development
```bash
# Start db if it is not started
docker-compose up -d postgres

# Build workspace
cargo build

# Run server in dev mode
cargo run --package stroem-server --bin stroem-server -- -v --config /Users/ala/workspace/stroem-hub/stroem/files/server-config.dev.yaml

# Run worker
cargo run --package workflow-worker --bin workflow-worker -- --verbose --server http://localhost:8080

# Frontend development
cd ui && pnpm dev

# Database migrations
# Handled automatically by server on startup
```

### Testing & Quality
```bash
# Format code
cargo fmt
cd ui && pnpm format

# Lint frontend
cd ui && pnpm lint

# Type checking
cd ui && pnpm check
```

### Build & Deploy
```bash
# Build Docker images
docker build -f Dockerfile.server -t stroem-server .
docker build -f Dockerfile.worker -t stroem-worker .

# Build frontend for production
cd ui && pnpm build
```