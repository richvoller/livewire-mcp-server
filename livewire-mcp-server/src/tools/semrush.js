// ==============================================================================
// TOOL: get_semrush_data
// ==============================================================================
// This file defines the SEMrush tool. It allows your AI assistant to pull
// domain analytics data from the SEMrush API, including organic keywords,
// traffic estimates, and backlink overview.
//
// THIS TOOL IS OPTIONAL — it only loads if SEMRUSH_API_KEY is set in your .env.
//
// PREREQUISITES:
// - A SEMrush subscription with API access.
// - Set SEMRUSH_API_KEY in your .env file.
// - API docs: https://developer.semrush.com/api/
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_semrush_data',
  description:
    'Retrieves SEMrush domain analytics for a given domain. Returns organic ' +
    'keyword count, estimated organic traffic, paid keyword count, backlinks ' +
    'count, and authority score. You can choose from several report types: ' +
    'domain_organic (organic keywords), domain_adwords (paid keywords), or ' +
    'backlinks_overview. Useful for competitive analysis and benchmarking.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description:
          'The domain to look up (e.g., "example.com"). Do not include http:// or trailing slashes.',
      },
      reportType: {
        type: 'string',
        enum: ['domain_organic', 'domain_adwords', 'backlinks_overview'],
        description:
          'The type of SEMrush report to pull. Options: ' +
          '"domain_organic" — organic keyword rankings & traffic estimates, ' +
          '"domain_adwords" — paid search keywords & ad data, ' +
          '"backlinks_overview" — backlink count, referring domains, authority score.',
      },
      database: {
        type: 'string',
        description:
          'The SEMrush regional database to query (e.g., "uk" for United Kingdom, ' +
          '"us" for United States, "au" for Australia). Defaults to "uk".',
      },
      limit: {
        type: 'number',
        description:
          'The maximum number of rows to return (default: 10, max: 10000).',
      },
    },
    required: ['domain', 'reportType'],
  },
};

// ---------------------------------------------------------------------------
// Tool Handler
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit
  rateLimiter.checkAndRecord();

  // Step 2: Extract inputs
  const { domain, reportType, database = 'uk', limit = 10 } = args;

  // Step 3: Load API key
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SEMrush API key is not configured. ' +
      'Please set SEMRUSH_API_KEY in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 4: Build the SEMrush API request.
    // SEMrush uses a simple query-string based API that returns CSV or
    // JSON depending on the endpoint. We use the analytics reports here.
    //
    // API Docs: https://developer.semrush.com/api/v3/analytics/
    // -----------------------------------------------------------------
    let apiUrl;
    let params;

    if (reportType === 'backlinks_overview') {
      // Backlinks overview uses a different endpoint
      apiUrl = 'https://api.semrush.com/analytics/v1/';
      params = {
        key: apiKey,
        type: 'backlinks_overview',
        target: domain,
        target_type: 'root_domain',
        export_columns: 'total,domains_num,urls_num,ips_num,score',
      };
    } else {
      // Domain organic / domain adwords
      apiUrl = 'https://api.semrush.com/';
      params = {
        key: apiKey,
        type: reportType,
        domain: domain,
        database: database,
        display_limit: limit,
        export_columns:
          reportType === 'domain_organic'
            ? 'Ph,Po,Nq,Cp,Ur,Tr'  // Keyword, Position, Volume, CPC, URL, Traffic %
            : 'Ph,Po,Nq,Cp,Ur,Tt', // Keyword, Position, Volume, CPC, URL, Title
      };
    }

    const apiResponse = await axios.get(apiUrl, {
      params,
      timeout: 30000,
    });

    // -----------------------------------------------------------------
    // Step 5: Parse the SEMrush CSV response into structured data.
    // SEMrush returns semicolon-separated values by default.
    // -----------------------------------------------------------------
    const rawData = apiResponse.data;

    // Check for SEMrush error responses
    if (typeof rawData === 'string' && rawData.startsWith('ERROR')) {
      return {
        content: [{ type: 'text', text: `SEMrush API returned an error: ${rawData}` }],
        isError: true,
      };
    }

    // Parse CSV: first line is headers, subsequent lines are data
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split(';');
    const rows = lines.slice(1).map((line) => {
      const values = line.split(';');
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      return row;
    });

    // Return formatted data
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              domain,
              reportType,
              database,
              totalRows: rows.length,
              data: rows,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error.response
      ? `SEMrush API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `SEMrush Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler
module.exports = { toolDefinition, handler };
