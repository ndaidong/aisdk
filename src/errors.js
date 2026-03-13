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
   * @param {string} meta.model         - Model ID that was called
   * @param {string} [meta.raw]         - Raw response body from provider
   */
  constructor(message, {
    status, provider, model, raw,
  } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
    this.provider = provider
    this.model = model
    this.raw = raw
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
 * Classifies an HTTP response into ProviderError or InputError and throws it.
 *
 * @param {Response} res
 * @param {string} provider
 * @param {string} model
 * @returns {Promise<never>}
 */
export const throwHttpError = async (res, provider, model) => {
  const raw = await res.text()
  const meta = {
    status: res.status, provider, model, raw,
  }
  const message = `${provider}/${model} responded with HTTP ${res.status}`

  if (PROVIDER_ERROR_STATUSES.has(res.status)) {
    throw new ProviderError(message, meta)
  }

  throw new InputError(message, meta)
}
