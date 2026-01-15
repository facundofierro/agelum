#!/bin/bash

# Build the Docker image
echo "🐳 Building Agelum MCP Docker image..."
docker build -f apps/web/Dockerfile -t agelum-mcp .

echo "✅ Docker image built: agelum-mcp"
