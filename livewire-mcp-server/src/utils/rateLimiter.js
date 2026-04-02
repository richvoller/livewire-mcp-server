// ==============================================================================
// RATE LIMITER UTILITY
// ==============================================================================
// This module implements a simple "sliding window" rate limiter. Its purpose is
// to prevent you from accidentally making too many requests to your paid SEO
// APIs (like Ahrefs or SEMrush) in a short period of time.
//
// HOW IT WORKS:
// - It tracks timestamps of recent requests in an array.
// - Before each new request, it removes timestamps older than the time window.
// - If the number of remaining timestamps exceeds the max allowed, the request
//   is rejected (or delayed).
//
// You can configure the limits via your .env file:
//   RATE_LIMIT_MAX_REQUESTS — max requests allowed per window (default: 30)
//   RATE_LIMIT_WINDOW_MS    — time window in milliseconds (default: 60000 = 1 min)
// ==============================================================================

class RateLimiter {
  /**
   * Creates a new RateLimiter instance.
   * @param {number} maxRequests - Maximum number of requests allowed in the time window.
   * @param {number} windowMs   - The time window in milliseconds.
   */
  constructor(maxRequests = 30, windowMs = 60000) {
    // The maximum number of requests allowed within the sliding window
    this.maxRequests = maxRequests;

    // The duration of the sliding window in milliseconds
    this.windowMs = windowMs;

    // An array that stores the timestamp of each recent request
    this.requestTimestamps = [];
  }

  /**
   * Cleans up timestamps that are older than the current time window.
   * This keeps our array from growing indefinitely.
   */
  _cleanup() {
    const now = Date.now();
    // Keep only timestamps that fall within the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
  }

  /**
   * Checks whether a new request is allowed under the current rate limit.
   * @returns {boolean} - true if the request can proceed, false if rate-limited.
   */
  canMakeRequest() {
    // First, remove any expired timestamps
    this._cleanup();

    // If we have fewer requests than the max, we're good to go
    return this.requestTimestamps.length < this.maxRequests;
  }

  /**
   * Records a new request timestamp. Call this AFTER you've confirmed the
   * request is allowed (i.e., after canMakeRequest() returns true).
   */
  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * A convenience method that checks the limit and records the request in one step.
   * Throws an error if the rate limit has been exceeded.
   * Use this in your tool handlers before making an API call.
   *
   * @throws {Error} If the rate limit has been exceeded.
   */
  checkAndRecord() {
    if (!this.canMakeRequest()) {
      const waitTime = Math.ceil(this.windowMs / 1000);
      throw new Error(
        `Rate limit exceeded. You've made ${this.maxRequests} requests in the ` +
        `last ${waitTime} seconds. Please wait before trying again.`
      );
    }
    this.recordRequest();
  }

  /**
   * Returns how many requests are remaining in the current window.
   * Useful for logging or debugging.
   * @returns {number} - The number of requests still available.
   */
  remainingRequests() {
    this._cleanup();
    return Math.max(0, this.maxRequests - this.requestTimestamps.length);
  }

  /**
   * Waits until a request slot becomes available, then records the request.
   * This is useful if you'd rather wait than throw an error.
   *
   * @returns {Promise<void>} - Resolves when a slot is available.
   */
  async waitForSlot() {
    while (!this.canMakeRequest()) {
      // Calculate how long until the oldest request expires from the window
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.windowMs - (Date.now() - oldestTimestamp) + 50; // +50ms buffer
      // Wait for that duration
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.recordRequest();
  }
}

// Export the RateLimiter class so other files can use it
module.exports = { RateLimiter };
