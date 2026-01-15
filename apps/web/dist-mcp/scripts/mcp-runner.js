#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const mcp_js_1 = require("../src/lib/mcp.js");
const config_js_1 = require("../src/lib/config.js");
async function run() {
    // Load global config to find root if CWD fails
    const config = (0, config_js_1.getAgelumConfig)();
    const globalRoot = config?.rootGitDirectory;
    const server = (0, mcp_js_1.createAgelumMcpServer)(globalRoot);
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('Agelum MCP Server running on stdio');
}
run().catch((error) => {
    console.error('Fatal error running MCP server:', error);
    process.exit(1);
});
