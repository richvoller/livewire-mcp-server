// ==============================================================================
// TOOL REGISTRY
// ==============================================================================
// This file is the central hub for all your SEO tools. It imports every tool
// module, collects their definitions and handlers, and exports them so the
// main server can register them with the MCP protocol.
//
// CORE TOOLS (always loaded):
//   - Google Search Console (gsc.js)
//   - Google Analytics 4 (ga4.js)
//   - PageSpeed Insights (pagespeed.js)
//   - Rank Tracker (ranktracker.js) — defaults to SERPRobot
//
// OPTIONAL TOOLS (loaded automatically when their API key is set in .env):
//   - SEMrush (semrush.js)   — loaded when SEMRUSH_API_KEY is present
//   - Ahrefs (ahrefs.js)     — loaded when AHREFS_API_KEY is present
//
// TO ADD A NEW TOOL:
//   1. Create a new file in this folder (e.g., src/tools/myNewTool.js)
//   2. Export a `toolDefinition` object and a `handler` function from it
//   3. Import it below and add it to the `tools` array
//   That's it! The server will automatically pick it up.
// ==============================================================================

// ---------------------------------------------------------------------------
// Import CORE tool modules (always available)
// ---------------------------------------------------------------------------
const gsc = require('./gsc');               // Google Search Console tool
const ga4 = require('./ga4');               // Google Analytics 4 tool
const pagespeed = require('./pagespeed');    // PageSpeed Insights tool
const ranktracker = require('./ranktracker'); // Rank Tracking tool (SERPRobot)

// ---------------------------------------------------------------------------
// Start with core tools that are always registered.
// ---------------------------------------------------------------------------
const tools = [
  { definition: gsc.toolDefinition, handler: gsc.handler },
  { definition: ga4.toolDefinition, handler: ga4.handler },
  { definition: pagespeed.toolDefinition, handler: pagespeed.handler },
  { definition: ranktracker.toolDefinition, handler: ranktracker.handler },
];

// ---------------------------------------------------------------------------
// OPTIONAL: Load SEMrush tool if the API key is configured.
// The user just needs to uncomment and fill in SEMRUSH_API_KEY in their .env
// file and this tool will automatically appear in Claude.
// ---------------------------------------------------------------------------
if (process.env.SEMRUSH_API_KEY) {
  const semrush = require('./semrush');
  tools.push({ definition: semrush.toolDefinition, handler: semrush.handler });
  console.error('[Livewire MCP] SEMrush API key detected — SEMrush tool enabled');
}

// ---------------------------------------------------------------------------
// OPTIONAL: Load Ahrefs tool if the API key is configured.
// The user just needs to uncomment and fill in AHREFS_API_KEY in their .env
// file and this tool will automatically appear in Claude.
// ---------------------------------------------------------------------------
if (process.env.AHREFS_API_KEY) {
  const ahrefs = require('./ahrefs');
  tools.push({ definition: ahrefs.toolDefinition, handler: ahrefs.handler });
  console.error('[Livewire MCP] Ahrefs API key detected — Ahrefs tool enabled');
}

// Export the tools array so the main server can register them
module.exports = { tools };
