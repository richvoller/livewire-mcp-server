// ==============================================================================
// LIVEWIRE MCP SERVER — MAIN ENTRY POINT
// ==============================================================================
// This is the core server file that initializes the Model Context Protocol (MCP)
// server and connects it to Claude Desktop (or any other MCP host) via Standard
// I/O (stdio). It registers all your SEO tools so the AI assistant knows they
// exist and can call them on your behalf.
//
// HOW IT WORKS:
//   1. Loads environment variables from your .env file (API keys, etc.)
//   2. Creates an MCP Server instance with a name and version
//   3. Registers handlers for "list tools" and "call tool" requests
//   4. Starts the stdio transport so the server can communicate with Claude
//
// TO START THE SERVER:
//   npm start
//
// Claude Desktop will launch this script automatically when configured correctly.
// ==============================================================================

// ---------------------------------------------------------------------------
// Step 1: Load environment variables from the .env file.
// The dotenv package reads your .env file and makes all the key=value pairs
// available via process.env.YOUR_KEY. This is how we securely pass API keys
// without hardcoding them in the source code.
// replace the /FULL/PATH/TO/livewire-mcp-server/.env with your actual .env path
// ---------------------------------------------------------------------------
require('dotenv').config({ path: '/FULL/PATH/TO/livewire-mcp-server/.env' });

// ---------------------------------------------------------------------------
// Step 2: Import the MCP SDK modules.
// - Server:              The low-level server class that handles the MCP protocol
// - StdioServerTransport: Handles communication over standard input/output
//                         (this is how Claude Desktop talks to your server)
// We use the low-level Server class (not McpServer) so we can pass raw JSON
// Schema definitions directly, without needing Zod schemas.
// ---------------------------------------------------------------------------
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// ---------------------------------------------------------------------------
// Step 3: Import our custom modules.
// - tools:       The array of SEO tool definitions and handlers (from src/tools/)
// - RateLimiter: Our rate limiting utility to prevent API spam (from src/utils/)
// ---------------------------------------------------------------------------
const { tools } = require('./tools/index');
const { RateLimiter } = require('./utils/rateLimiter');

// ---------------------------------------------------------------------------
// Step 4: Initialize the Rate Limiter.
// This creates a shared rate limiter that all tools use before making API calls.
// You can configure the limits via your .env file:
//   RATE_LIMIT_MAX_REQUESTS — max requests per window (default: 30)
//   RATE_LIMIT_WINDOW_MS    — window duration in ms (default: 60000 = 1 min)
// ---------------------------------------------------------------------------
const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 30,
  parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000
);

// ---------------------------------------------------------------------------
// Step 5: Create the MCP Server instance.
// The name and version are shown to the MCP host (Claude Desktop) so it
// knows which server it's connected to. You can customize these.
// We use the low-level Server class so we can register tools with raw JSON
// Schema and bypass the Zod requirement of the high-level McpServer class.
// ---------------------------------------------------------------------------
const server = new Server(
  {
    name: 'livewire-seo-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==============================================================================
// TOOL REGISTRATION
// ==============================================================================
// We use the low-level Server class, which lets us handle tools/list and
// tools/call requests directly with raw JSON Schema — no Zod conversion needed.
// ==============================================================================

// ---------------------------------------------------------------------------
// Build a lookup map of tools keyed by name for fast access during calls.
// ---------------------------------------------------------------------------
const toolMap = {};
for (const tool of tools) {
  toolMap[tool.definition.name] = tool;
  console.error(`[Livewire MCP] Registered tool: ${tool.definition.name}`);
}

// ---------------------------------------------------------------------------
// Handle tools/list — return each tool's name, description, and JSON Schema.
// ---------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(({ definition }) => ({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
    })),
  };
});

// ---------------------------------------------------------------------------
// Handle tools/call — look up the tool, run its handler, return the result.
// ---------------------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap[name];

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(args || {}, rateLimiter);
    return result;
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error in ${name}: ${error.message}` }],
      isError: true,
    };
  }
});

// ==============================================================================
// START THE SERVER
// ==============================================================================
// This is the main startup function. It creates a StdioServerTransport (which
// uses standard input/output for communication) and connects the MCP server
// to it. Claude Desktop will pipe data in/out through stdin/stdout.
//
// We use an async IIFE (Immediately Invoked Function Expression) so we can
// use await at the top level.
// ==============================================================================
(async () => {
  try {
    // Create the stdio transport — this handles reading from stdin and
    // writing to stdout, which is how Claude Desktop communicates with
    // your MCP server.
    const transport = new StdioServerTransport();

    // Connect the server to the transport and start listening for requests.
    // Once connected, the server will respond to tool list and tool call
    // requests from the MCP host (Claude Desktop).
    await server.connect(transport);

    // Log a startup message. We use console.error instead of console.log
    // because stdout is reserved for MCP protocol messages. Any logging
    // or debugging output must go to stderr.
    console.error('[Livewire MCP] Server started successfully');
    console.error(`[Livewire MCP] ${tools.length} SEO tools registered and ready`);
    console.error('[Livewire MCP] Rate limiter configured: ' +
      `${rateLimiter.maxRequests} requests per ${rateLimiter.windowMs / 1000}s window`);
  } catch (error) {
    // If the server fails to start, log the error and exit with a non-zero code
    console.error('[Livewire MCP] Fatal error starting server:', error);
    process.exit(1);
  }
})();

// ==============================================================================
// GRACEFUL SHUTDOWN
// ==============================================================================
// Handle termination signals so the server shuts down cleanly.
// This prevents zombie processes if Claude Desktop is closed.
// ==============================================================================
process.on('SIGINT', () => {
  console.error('[Livewire MCP] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Livewire MCP] Received SIGTERM, shutting down...');
  process.exit(0);
});

// Handle uncaught errors gracefully so the server doesn't crash silently
process.on('uncaughtException', (error) => {
  console.error('[Livewire MCP] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Livewire MCP] Unhandled promise rejection:', reason);
  process.exit(1);
});
