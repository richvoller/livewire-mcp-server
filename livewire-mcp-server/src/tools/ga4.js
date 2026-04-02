// ==============================================================================
// TOOL: get_ga4_traffic
// ==============================================================================
// This file defines the Google Analytics 4 (GA4) tool. It allows your AI
// assistant to retrieve session data, engagement metrics, and conversions
// from a GA4 property for a specified date range.
//
// PREREQUISITES:
// - You need OAuth 2.0 credentials from the Google Cloud Console with the
//   "Google Analytics Data API" (v1beta) enabled.
// - Set GA4_PROPERTY_ID in your .env file (found in GA4 Admin → Property Settings).
// - Reuses the same Google OAuth tokens as GSC (GSC_CLIENT_ID, etc.) unless
//   you configure separate GA4 credentials.
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
// This object describes the tool to the MCP client. The AI reads this to
// understand what the tool does and what inputs it needs.
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_ga4_traffic',
  description:
    'Retrieves session data, engagement metrics, and conversions from ' +
    'Google Analytics 4 for a specified property and date range. Returns ' +
    'metrics like sessions, engaged sessions, bounce rate, and conversions. ' +
    'Useful for understanding website traffic patterns and user behavior.',
  inputSchema: {
    type: 'object',
    properties: {
      propertyId: {
        type: 'string',
        description:
          'The GA4 Property ID (e.g., "123456789"). Found in GA4 Admin → Property Settings.',
      },
      startDate: {
        type: 'string',
        description:
          'The start date in YYYY-MM-DD format (e.g., "2025-01-01"). ' +
          'You can also use relative dates like "7daysAgo" or "30daysAgo".',
      },
      endDate: {
        type: 'string',
        description:
          'The end date in YYYY-MM-DD format (e.g., "2025-01-31"). ' +
          'You can also use "today" or "yesterday".',
      },
    },
    required: ['propertyId'],
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
// This function is called when the AI assistant invokes the "get_ga4_traffic"
// tool. It queries the GA4 Data API and returns formatted traffic data.
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit before making any API calls
  rateLimiter.checkAndRecord();

  // Step 2: Extract the input arguments provided by the AI
  const { propertyId } = args;
  let { startDate, endDate } = args;

  const defaults = getDefaultDateRange();
  startDate = startDate || defaults.startDate;
  endDate = endDate || defaults.endDate;

  // Step 3: Load API credentials from environment variables.
  // By default, we reuse the GSC OAuth credentials. If you have separate
  // GA4 credentials, change these to GA4_CLIENT_ID, etc.
  const clientId = process.env.GA4_CLIENT_ID || process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GA4_CLIENT_SECRET || process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GA4_REFRESH_TOKEN || process.env.GSC_REFRESH_TOKEN;

  // Step 4: Validate that credentials are present
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Analytics credentials are not configured. ' +
      'Please set GSC_CLIENT_ID/SECRET/REFRESH_TOKEN (or GA4-specific ones) in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 5: Exchange the refresh token for a fresh access token.
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
    // Step 6: Make the request to the GA4 Data API (v1beta).
    // We request several commonly used SEO/traffic metrics and break
    // them down by date so you can see daily trends.
    //
    // API Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
    // -----------------------------------------------------------------
    const apiResponse = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        // Date range for the report
        dateRanges: [{ startDate, endDate }],

        // Dimensions: how to group the data (by date in this case)
        dimensions: [{ name: 'date' }],

        // Metrics: what data points to retrieve
        metrics: [
          { name: 'sessions' },            // Total sessions
          { name: 'engagedSessions' },      // Sessions with engagement (>10s, conversion, or 2+ pages)
          { name: 'totalUsers' },           // Unique users
          { name: 'newUsers' },             // First-time users
          { name: 'bounceRate' },           // Percentage of non-engaged sessions
          { name: 'averageSessionDuration' }, // Avg session length in seconds
          { name: 'screenPageViews' },      // Total page views
          { name: 'conversions' },          // Total conversion events
        ],

        // Order results by date (ascending) so the trend is easy to read
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],

        // You can add more customizations here:
        // - dimensionFilter: to filter by page path, source, etc.
        // - metricFilter: to filter by metric thresholds
        // - limit: to cap the number of rows returned
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
    // -----------------------------------------------------------------
    const rows = apiResponse.data.rows || [];
    const formattedResults = rows.map((row) => ({
      date: row.dimensionValues[0].value,                                // Date string (YYYYMMDD)
      sessions: parseInt(row.metricValues[0].value, 10),                 // Sessions count
      engagedSessions: parseInt(row.metricValues[1].value, 10),          // Engaged sessions
      totalUsers: parseInt(row.metricValues[2].value, 10),               // Total users
      newUsers: parseInt(row.metricValues[3].value, 10),                 // New users
      bounceRate: `${(parseFloat(row.metricValues[4].value) * 100).toFixed(2)}%`, // Bounce rate %
      avgSessionDuration: `${parseFloat(row.metricValues[5].value).toFixed(1)}s`, // Duration
      pageViews: parseInt(row.metricValues[6].value, 10),                // Page views
      conversions: parseInt(row.metricValues[7].value, 10),              // Conversions
    }));

    // Calculate summary totals across the entire date range
    const summary = formattedResults.reduce(
      (acc, row) => ({
        totalSessions: acc.totalSessions + row.sessions,
        totalUsers: acc.totalUsers + row.totalUsers,
        totalPageViews: acc.totalPageViews + row.pageViews,
        totalConversions: acc.totalConversions + row.conversions,
      }),
      { totalSessions: 0, totalUsers: 0, totalPageViews: 0, totalConversions: 0 }
    );

    // Return the data in the format MCP expects
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              propertyId,
              dateRange: { startDate, endDate },
              summary,
              dailyData: formattedResults,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // -----------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------
    const errorMessage = error.response
      ? `GA4 API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `GA4 Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler for the main server to register
module.exports = { toolDefinition, handler };
