#!/bin/bash

# Agelum MCP Setup Script
# This script builds the MCP server and creates a global command for use in IDEs.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DEST="/usr/local/bin/agelum-mcp"

echo "🚀 Setting up Agelum MCP Server..."

# 1. Build the Docker image
./scripts/build-docker.sh

# 2. Create a wrapper script in /usr/local/bin
echo "🔗 Creating global command: $BIN_DEST"

# Check if we have sudo access, otherwise warn
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  # If we can't sudo, we can't write to /usr/local/bin.
  # We should check if ~/.local/bin exists and is in PATH, or just warn.
  echo "⚠️  'sudo' not found. Cannot install global command to $BIN_DEST."
  echo "⚠️  Please ensure you can run docker commands."
  echo "⚠️  You can run the docker command manually or alias it."
  echo "    alias agelum-mcp='docker run --rm -i --init -v \"\$(pwd)\":\"\$(pwd)\" -w \"\$(pwd)\" agelum-mcp'"
  exit 0
fi

cat <<EOF | $SUDO tee "$BIN_DEST" > /dev/null
#!/bin/bash
# Wrapper for Agelum MCP Server (Docker)
# Mounts the current directory to the same path in the container
# and sets it as the working directory.

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running" >&2
  exit 1
fi

# Run the container
# -i: Interactive (keep stdin open)
# --rm: Remove container after exit
# -v \$(pwd):\$(pwd): Mount current dir to same path
# -w \$(pwd): Set working dir to same path
# --init: Use init process to handle signals
# agelum-mcp: The image name

exec docker run --rm -i --init \\
  -v "\$(pwd)":"\$(pwd)" \\
  -w "\$(pwd)" \\
  agelum-mcp "\$@"
EOF

$SUDO chmod +x "$BIN_DEST"

echo "✅ Setup complete!"
echo "You can now use 'agelum-mcp' as the command in your IDE MCP settings."

echo ""
echo "Example Config for mcp.json:"
echo "---------------------------"
cat <<EOF
{
  "mcpServers": {
    "agelum": {
      "command": "agelum-mcp"
    }
  }
}
---------------------------"
EOF
