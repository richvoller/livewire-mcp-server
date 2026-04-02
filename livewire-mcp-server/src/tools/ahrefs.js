// ==============================================================================
// TOOL: get_ahrefs_data
// ==============================================================================
// This file defines the Ahrefs tool. It allows your AI assistant to pull
// domain rating, backlink data, and organic keyword estimates from the
// Ahrefs API.
//
// THIS TOOL IS OPTIONAL — it only loads if AHREFS_API_KEY is set in your .env.
//
// PREREQUISITES:
// - An Ahrefs subscription with API access.
// - Set AHREFS_API_KEY in your .env file.
// - API docs: https://ahrefs.com/api/documentation
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_ahrefs_data',
  description:
    'Retrieves Ahrefs SEO metrics for a given domain. Returns domain rating (DR), ' +
    'referring domains count, backlinks count, and organic keyword estimates. ' +
    'You can choose from report types: domain_rating, backlinks_overview, or ' +
    'organic_keywords. Useful for backlink analysis and competitive research.',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          'The domain or URL to look up (e.g., "example.com"). Do not include http:// or trailing slashes.',
      },
      reportType: {
        type: 'string',
        enum: ['domain_rating', 'backlinks_overview', 'organic_keywords'],
        description:
          'The type of Ahrefs report to pull. Options: ' +
          '"domain_rating" — the domain\'s DR score and referring domains, ' +
          '"backlinks_overview" — total backlinks, referring domains, dofollow links, ' +
          '"organic_keywords" — estimated organic keywords and traffic.',
      },
      limit: {
        type: 'number',
        description:
          'The maximum number of rows to return for keyword reports (default: 10).',
      },
    },
    required: ['target', 'reportType'],
  },
};

// ---------------------------------------------------------------------------
// Tool Handler
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit
  rateLimiter.checkAndRecord();

  // Step 2: Extract inputs
  const { target, reportType, limit = 10 } = args;

  // Step 3: Load API key
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Ahrefs API key is not configured. ' +
      'Please set AHREFS_API_KEY in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 4: Build the Ahrefs API request.
    // Ahrefs API v3 uses a REST-style JSON API with Bearer token auth.
    //
    // API Docs: https://ahrefs.com/api/documentation
    // -----------------------------------------------------------------
    let endpoint;
    let params = {};

    switch (reportType) {
      case 'domain_rating':
        endpoint = 'https://api.ahrefs.com/v3/site-explorer/domain-rating';
        params = {
          target,
          date: new Date().toISOString().split('T')[0], // Today's date
        };
        break;

      case 'backlinks_overview':
        endpoint = 'https://api.ahrefs.com/v3/site-explorer/metrics';
        params = {
          target,
          date: new Date().toISOString().split('T')[0],
          mode: 'domain',
        };
        break;

      case 'organic_keywords':
        endpoint = 'https://api.ahrefs.com/v3/site-explorer/organic-keywords';
        params = {
          target,
          select: 'keyword,volume,position,traffic',
          mode: 'domain',
          country: 'gb',
          limit,
        };
        break;

      default:
        throw new Error(`Unknown Ahrefs report type: ${reportType}`);
    }

    const apiResponse = await axios.get(endpoint, {
      params,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    // -----------------------------------------------------------------
    // Step 5: Format and return the response.
    // -----------------------------------------------------------------
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              target,
              reportType,
              data: apiResponse.data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error.response
      ? `Ahrefs API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `Ahrefs Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler
module.exports = { toolDefinition, handler };
