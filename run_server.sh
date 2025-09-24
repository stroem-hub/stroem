#!/bin/sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Strøm Server${NC}"

# clean
rm -rf ./server/static/*
rm -rf ./ui/dist/*

# build frontend
# cd ./ui
# pnpm build
# cd ..
# cp -r ./ui/dist/ ./server/static/

cargo run --package stroem-server --bin stroem-server -- -v --config ./files/server-config.dev.yaml
