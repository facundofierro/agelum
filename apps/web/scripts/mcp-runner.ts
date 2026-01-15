#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgelumMcpServer, findRepoRootPath } from '../src/lib/mcp.js';
import { getAgelumConfig } from '../src/lib/config.js';

async function run() {
  // Load global config to find root if CWD fails
  const config = getAgelumConfig();
  const globalRoot = config?.rootGitDirectory;

  const server = createAgelumMcpServer(globalRoot);
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('Agelum MCP Server running on stdio');
}

run().catch((error) => {
  console.error('Fatal error running MCP server:', error);
  process.exit(1);
});
