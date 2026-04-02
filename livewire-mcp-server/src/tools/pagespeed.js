// ==============================================================================
// TOOL: get_pagespeed_insights
// ==============================================================================
// This file defines the PageSpeed Insights tool. It allows your AI assistant
// to pull Core Web Vitals and Lighthouse performance scores for any URL using
// the Google PageSpeed Insights API.
//
// PREREQUISITES:
// - Get a free API key from the Google Cloud Console:
//   1. Enable the "PageSpeed Insights API"
//   2. Create an API Key under "Credentials"
// - Set PAGESPEED_API_KEY in your .env file.
// ==============================================================================

const axios = require('axios');

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------
// This object describes the tool to the MCP client. The AI uses this info
// to know when to call the tool and what parameters to pass.
// ---------------------------------------------------------------------------
const toolDefinition = {
  name: 'get_pagespeed_insights',
  description:
    'Pulls Core Web Vitals and Lighthouse performance scores for any URL ' +
    'using the Google PageSpeed Insights API. Returns metrics like LCP, FID, ' +
    'CLS, performance score, accessibility score, and more. Supports both ' +
    'desktop and mobile analysis strategies.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          'The full URL to analyze (e.g., "https://www.example.com/page").',
      },
      strategy: {
        type: 'string',
        enum: ['desktop', 'mobile'],
        description:
          'The analysis strategy — either "desktop" or "mobile". ' +
          'Mobile is recommended as Google uses mobile-first indexing.',
      },
    },
    required: ['url', 'strategy'],
  },
};

// ---------------------------------------------------------------------------
// Tool Handler
// ---------------------------------------------------------------------------
// This function is called when the AI assistant invokes "get_pagespeed_insights".
// It calls the PageSpeed Insights API and returns a clean summary of the results.
// ---------------------------------------------------------------------------
async function handler(args, rateLimiter) {
  // Step 1: Check rate limit before making any API calls
  rateLimiter.checkAndRecord();

  // Step 2: Extract the input arguments
  const { url, strategy } = args;

  // Step 3: Load the API key from environment variables
  const apiKey = process.env.PAGESPEED_API_KEY;

  // Step 4: Validate that the API key is configured
  if (!apiKey) {
    throw new Error(
      'PageSpeed Insights API key is not configured. ' +
      'Please set PAGESPEED_API_KEY in your .env file.'
    );
  }

  try {
    // -----------------------------------------------------------------
    // Step 5: Make the request to the PageSpeed Insights API.
    // This is a simple GET request with query parameters.
    //
    // API Docs: https://developers.google.com/speed/docs/insights/v5/get-started
    // -----------------------------------------------------------------
    const apiResponse = await axios.get(
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
      {
        params: {
          url,                     // The URL to test
          strategy,                // 'desktop' or 'mobile'
          key: apiKey,             // Your API key
          // You can request specific categories by adding:
          // category: ['performance', 'accessibility', 'best-practices', 'seo']
          // By default, all categories are returned.
        },
        timeout: 60000, // 60 second timeout — PageSpeed can be slow
      }
    );

    const data = apiResponse.data;

    // -----------------------------------------------------------------
    // Step 6: Extract the Lighthouse scores.
    // Lighthouse runs a full audit and scores each category 0–1.
    // We multiply by 100 to get the familiar 0–100 scale.
    // -----------------------------------------------------------------
    const lighthouseCategories = data.lighthouseResult?.categories || {};
    const scores = {
      performance: Math.round((lighthouseCategories.performance?.score || 0) * 100),
      accessibility: Math.round((lighthouseCategories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lighthouseCategories['best-practices']?.score || 0) * 100),
      seo: Math.round((lighthouseCategories.seo?.score || 0) * 100),
    };

    // -----------------------------------------------------------------
    // Step 7: Extract Core Web Vitals from the field data (CrUX).
    // These are real-user metrics from the Chrome User Experience Report.
    // Note: Not all URLs have field data — it depends on traffic volume.
    // -----------------------------------------------------------------
    const fieldMetrics = data.loadingExperience?.metrics || {};
    const coreWebVitals = {
      // Largest Contentful Paint — how fast the main content loads
      LCP: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS
        ? {
            value: `${fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile}ms`,
            category: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.category,
          }
        : 'No field data available',

      // First Input Delay — how responsive the page is to user interaction
      FID: fieldMetrics.FIRST_INPUT_DELAY_MS
        ? {
            value: `${fieldMetrics.FIRST_INPUT_DELAY_MS.percentile}ms`,
            category: fieldMetrics.FIRST_INPUT_DELAY_MS.category,
          }
        : 'No field data available',

      // Cumulative Layout Shift — how visually stable the page is
      CLS: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        ? {
            value: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100,
            category: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category,
          }
        : 'No field data available',

      // Interaction to Next Paint — responsiveness metric (replaces FID)
      INP: fieldMetrics.INTERACTION_TO_NEXT_PAINT
        ? {
            value: `${fieldMetrics.INTERACTION_TO_NEXT_PAINT.percentile}ms`,
            category: fieldMetrics.INTERACTION_TO_NEXT_PAINT.category,
          }
        : 'No field data available',

      // Time to First Byte — server responsiveness
      TTFB: fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE
        ? {
            value: `${fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.percentile}ms`,
            category: fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.category,
          }
        : 'No field data available',
    };

    // -----------------------------------------------------------------
    // Step 8: Extract key Lighthouse audit details (lab data).
    // These are the simulated test results from Lighthouse.
    // -----------------------------------------------------------------
    const audits = data.lighthouseResult?.audits || {};
    const labData = {
      firstContentfulPaint: audits['first-contentful-paint']?.displayValue || 'N/A',
      largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || 'N/A',
      totalBlockingTime: audits['total-blocking-time']?.displayValue || 'N/A',
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      speedIndex: audits['speed-index']?.displayValue || 'N/A',
      interactive: audits['interactive']?.displayValue || 'N/A',
    };

    // Return the formatted results to the AI
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              url,
              strategy,
              lighthouseScores: scores,
              coreWebVitals,
              labData,
              overallCategory: data.loadingExperience?.overall_category || 'N/A',
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
      ? `PageSpeed API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `PageSpeed Request Failed: ${error.message}`;

    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
}

// Export the tool definition and handler
module.exports = { toolDefinition, handler };
