/**
 * @fileoverview Structured error types for the AI client.
 *
 * Distinguishes between two categories of failure:
 *
 * - `ProviderError`  — transient or capacity issues on the provider side
 *                      (5xx, 429). Safe to retry with same or fallback model.
 *
 * - `InputError`     — request was rejected due to bad input or auth
 *                      (400, 401, 403, 422). Retrying will not help;
 *                      do NOT attempt fallback for these.
 *
 * Callers can use `instanceof` to decide retry/fallback strategy:
 *
 * @example
 * try {
 *   const result = await ai.ask({ model: 'gpt-4o', prompt: '...' })
 * } catch (err) {
 *   if (err instanceof ProviderError) {
 *     // safe to retry or fallback to another model
 *   } else if (err instanceof InputError) {
 *     // bad request — fix the input, do not retry
 *   }
 * }
 */

import { sanitizeForLogging } from './security.js'
import { getLogger } from './logger.js'

/**
 * Thrown when the provider returns a transient or server-side error.
 * HTTP 429 (rate limit) and 5xx responses produce this error.
 * Safe to retry or fall back to another model.
 */
export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {object} meta
   * @param {number} meta.status        - HTTP status code
   * @param {string} meta.provider      - Provider ID
   * @param {string} meta.model         - Model name that was called
   * @param {string} [meta.raw]         - Raw response body from provider
   * @param {number} [meta.retryAfter]  - Milliseconds to wait before retrying
   */
  constructor(message, {
    status, provider, model, raw, retryAfter,
  } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
    this.provider = provider
    this.model = model
    this.raw = raw
    this.retryAfter = retryAfter
  }
}

/**
 * Thrown when the provider rejects the request due to invalid input or auth.
 * HTTP 400, 401, 403, 422 responses produce this error.
 * Retrying or falling back will NOT resolve this — the input must be fixed.
 */
export class InputError extends Error {
  /**
   * @param {string} message
   * @param {object} meta
   * @param {number} meta.status
   * @param {string} meta.provider
   * @param {string} meta.model
   * @param {string} [meta.raw]
   */
  constructor(message, {
    status, provider, model, raw,
  } = {}) {
    super(message)
    this.name = 'InputError'
    this.status = status
    this.provider = provider
    this.model = model
    this.raw = raw
  }
}

/**
 * HTTP status codes that indicate a provider-side transient failure.
 * These are safe to retry or fall back on.
 * @type {Set<number>}
 */
export const PROVIDER_ERROR_STATUSES = new Set([429, 500, 502, 503, 504])

/**
 * Parses Retry-After header value to milliseconds
 * @param {string} value - Retry-After header value (seconds or HTTP date)
 * @returns {number|undefined} Milliseconds to wait, or undefined if unparseable
 */
const parseRetryAfter = (value) => {
  if (!value) return undefined
  
  // Try parsing as seconds (number)
  const seconds = parseInt(value, 10)
  if (!isNaN(seconds)) {
    return seconds * 1000 // Return milliseconds
  }
  
  // Try parsing as HTTP date
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.getTime() - Date.now()
  }
  
  return undefined
}

/**
 * Classifies an HTTP response into ProviderError or InputError and throws it.
 *
 * @param {Response} res
 * @param {string} provider
 * @param {string} model
 * @param {import('./logger.js').Logger} logger
 * @returns {Promise<never>}
 */
export const throwHttpError = async (res, provider, model, logger = getLogger()) => {
  const raw = await res.text()
  const sanitizedRaw = sanitizeForLogging(raw)
  const retryAfterHeader = res.headers.get('retry-after')
  
  const meta = {
    status: res.status,
    provider,
    model,
    raw: sanitizedRaw,
    retryAfter: retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined,
  }
  const message = `${model} responded with HTTP ${res.status}`
  
  // Only log if status is not a client error (avoid logging bad API keys, etc.)
  if (res.status >= 500 || res.status === 429) {
    logger.error(`[ai-client] ${message}`)
    if (sanitizedRaw) {
      logger.error(sanitizedRaw)
    }
    if (meta.retryAfter) {
      logger.error(`[ai-client] Retry-After: ${meta.retryAfter}ms`)
    }
  }
  
  if (PROVIDER_ERROR_STATUSES.has(res.status)) {
    throw new ProviderError(message, meta)
  }

  throw new InputError(message, meta)
}
