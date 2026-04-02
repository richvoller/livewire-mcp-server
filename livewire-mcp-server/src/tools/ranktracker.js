// ==============================================================================
// TOOL: get_rank_tracking_data
// ==============================================================================
// This file defines the Rank Tracking tool. It allows your AI assistant to
// retrieve current ranking positions for tracked keywords from your rank
// tracking provider.
//
// DEFAULT PROVIDER: SERPRobot (https://www.serprobot.com/)
// SERPRobot API calls are FREE to access data from your existing projects.
//
// WANT TO USE A DIFFERENT PROVIDER?
// See the "Swapping Your Rank Tracker" section in the README. The easiest
// approach is to paste this file into ChatGPT along with your provider's API
// documentation and ask it to rewrite the handler for you.
//
// PREREQUISITES:
// - Set RANK_TRACKER_API_KEY and RANK_TRACKER_API_BASE_URL in your .env file.
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
// This object tells the MCP client what this tool does and what inputs it needs.
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_rank_tracking_data',
  description:
    'Retrieves current ranking positions for tracked keywords from your rank ' +
    'tracking tool (SERPRobot by default). Returns keyword, current position, ' +
    'previous position, and position change. Useful for monitoring SEO progress ' +
    'and identifying ranking changes.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description:
          'The project ID in your rank tracking tool (e.g., your SERPRobot project ID). ' +
          'This identifies which set of tracked keywords to retrieve.',
      },
      limit: {
        type: 'number',
        description:
          'The maximum number of keyword rankings to return (default: 50).',
      },
    },
    required: ['projectId'],
  },
};

// ---------------------------------------------------------------------------
// Tool Handler — configured for SERPRobot
// ---------------------------------------------------------------------------
// This function is called when the AI invokes "get_rank_tracking_data".
// It makes a request to the SERPRobot API and returns the results.
//
// If you use a different rank tracking provider, you need to change:
//   1. The API endpoint URL (Step 5)
//   2. The request headers / auth method (Step 5)
//   3. The response parsing logic (Step 6)
//
// TIP: Copy this entire file and your provider's API docs into ChatGPT and
//      ask it to rewrite the handler function for your provider.
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit before making any API calls
  rateLimiter.checkAndRecord();

  // Step 2: Extract the input arguments
  const { projectId, limit = 50 } = args;

  // Step 3: Load API credentials from environment variables
  const apiKey = process.env.RANK_TRACKER_API_KEY;
  const baseUrl = process.env.RANK_TRACKER_API_BASE_URL;

  // Step 4: Validate that credentials are present
  if (!apiKey || !baseUrl) {
    throw new Error(
      'Rank Tracker API credentials are not configured. ' +
      'Please set RANK_TRACKER_API_KEY and RANK_TRACKER_API_BASE_URL in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 5: Make the request to the SERPRobot API.
    //
    // SERPRobot API endpoint to fetch keyword rankings for a project.
    // Docs: https://www.serprobot.com/api
    //
    // If you use a DIFFERENT provider, change the URL and headers below.
    // -----------------------------------------------------------------
    const apiResponse = await axios.get(baseUrl, {
      params: {
        api_key: apiKey,
        action: 'project',
        project_id: projectId,
      },
      timeout: 30000,
    });

    // -----------------------------------------------------------------
    // Step 6: Parse the SERPRobot response.
    //
    // SERPRobot returns an array of keyword objects. If your provider
    // uses different field names, update the mapping below.
    //
    // If you use a DIFFERENT provider, change the field names in the
    // .map() function to match your provider's response format.
    // -----------------------------------------------------------------
    const data = apiResponse.data;
    const keywords = Array.isArray(data) ? data : (data.keywords || data.data || data.results || []);

    const formattedResults = keywords.slice(0, limit).map((item) => ({
      keyword: item.keyword || item.search_term || item.query,
      currentPosition: item.position || item.rank || item.current_position,
      previousPosition: item.previous_position || item.previous_rank || null,
      positionChange: item.change || item.position_change || item.delta || null,
      searchVolume: item.search_volume || item.volume || null,
      url: item.url || item.landing_page || item.page || null,
    }));

    // Return the formatted data to the AI
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              projectId,
              totalKeywords: formattedResults.length,
              rankings: formattedResults,
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
      ? `Rank Tracker API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `Rank Tracker Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler
module.exports = { toolDefinition, handler };
