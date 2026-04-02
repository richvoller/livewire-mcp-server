// ==============================================================================
// TOOL: get_gsc_performance
// ==============================================================================
// This file defines the Google Search Console (GSC) tool. It allows your AI
// assistant to fetch top-performing pages and queries for a given domain,
// including clicks, impressions, CTR, and average position.
//
// PREREQUISITES:
// - You need OAuth 2.0 credentials (Client ID, Client Secret, Refresh Token)
//   from the Google Cloud Console with the Search Console API enabled.
// - Set GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN in your .env file.
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
// This object tells the MCP client (e.g., Claude Desktop) what this tool does,
// what inputs it expects, and which fields are required. The AI uses this
// description to decide when and how to call the tool.
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_gsc_performance',
  description:
    'Fetches the top-performing pages and queries from Google Search Console ' +
    'for a given domain and date range. Returns clicks, impressions, CTR, ' +
    'and average position data. Useful for understanding organic search ' +
    'performance and identifying top content.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description:
          'The domain to query in Search Console (e.g., "sc-domain:example.com" ' +
          'or "https://www.example.com/").',
      },
      startDate: {
        type: 'string',
        description:
          'The start date for the query in YYYY-MM-DD format (e.g., "2025-01-01").',
      },
      endDate: {
        type: 'string',
        description:
          'The end date for the query in YYYY-MM-DD format (e.g., "2025-01-31").',
      },
      limit: {
        type: 'number',
        description:
          'The maximum number of rows to return (default: 10, max: 25000).',
      },
    },
    required: ['domain'],
  },
};

// ---------------------------------------------------------------------------
// Helper: Provide default date range (last 30 days ending today)
// ---------------------------------------------------------------------------
function getDefaultDateRange() {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const startDate = start.toISOString().split('T')[0];
  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Tool Handler
// ---------------------------------------------------------------------------
// This function is called when the AI assistant invokes the "get_gsc_performance"
// tool. It makes an API request to the Google Search Console API and returns
// the results.
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit before making any API calls
  rateLimiter.checkAndRecord();

  // Step 2: Extract the input arguments provided by the AI
  const { domain, limit = 10 } = args;
  let { startDate, endDate } = args;

  const defaults = getDefaultDateRange();
  startDate = startDate || defaults.startDate;
  endDate = endDate || defaults.endDate;

  // Step 3: Load API credentials from environment variables
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;

  // Step 4: Validate that credentials are present
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Search Console credentials are not configured. ' +
      'Please set GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 5: Exchange the refresh token for a fresh access token.
    // Google OAuth tokens expire after ~1 hour, so we always get a new
    // one using the long-lived refresh token stored in .env.
    // -----------------------------------------------------------------
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }
    );
    const accessToken = tokenResponse.data.access_token;

    // -----------------------------------------------------------------
    // Step 6: Make the actual request to the Search Console API.
    // We're querying the "searchAnalytics" endpoint, which returns
    // clicks, impressions, CTR, and position data.
    //
    // API Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
    // -----------------------------------------------------------------
    const apiResponse = await axios.post(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(domain)}/searchAnalytics/query`,
      {
        startDate,
        endDate,
        dimensions: ['query', 'page'], // Group results by search query and page URL
        rowLimit: limit,               // How many rows to return
        // You can customize these fields:
        // - dimensionFilterGroups: to filter by specific queries or pages
        // - aggregationType: 'auto', 'byPage', or 'byProperty'
        // - type: 'web', 'image', 'video', 'news', or 'discover'
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // -----------------------------------------------------------------
    // Step 7: Format the response data for the AI to read.
    // We transform the raw API response into a cleaner structure.
    // -----------------------------------------------------------------
    const rows = apiResponse.data.rows || [];
    const formattedResults = rows.map((row) => ({
      query: row.keys[0],                              // The search query
      page: row.keys[1],                                // The page URL
      clicks: row.clicks,                               // Number of clicks
      impressions: row.impressions,                      // Number of impressions
      ctr: `${(row.ctr * 100).toFixed(2)}%`,            // Click-through rate as %
      position: row.position.toFixed(1),                 // Average position
    }));

    // Return the data in the format MCP expects (an array of content blocks)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              domain,
              dateRange: { startDate, endDate },
              totalResults: formattedResults.length,
              results: formattedResults,
            },
            null,
            2 // Pretty-print with 2 spaces for readability
          ),
        },
      ],
    };
  } catch (error) {
    // -----------------------------------------------------------------
    // Error Handling: If anything goes wrong (auth failure, API error, etc.),
    // we catch it here and return a helpful error message to the AI.
    // -----------------------------------------------------------------
    const errorMessage = error.response
      ? `GSC API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `GSC Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler so the main server can register them
module.exports = { toolDefinition, handler };
