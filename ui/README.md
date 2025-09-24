# Strøm UI

React-based user interface for the Strøm orchestration platform.

## Technology Stack

- **React 19.1.1** with TypeScript
- **Vite** for build tooling
- **TailwindCSS 4.1.13** for styling
- **React Router 7.9.1** for navigation
- **pnpm** for package management

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm type-check

# Lint code
pnpm lint

# Format code
pnpm format
```

## Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI primitives
│   ├── layout/         # Layout components
│   └── widgets/        # Dashboard widgets
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API service layer
├── contexts/           # React contexts
├── types/              # TypeScript definitions
├── utils/              # Utility functions
└── styles/             # Global styles
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:8080)
- `VITE_DEV_MODE` - Development mode flag