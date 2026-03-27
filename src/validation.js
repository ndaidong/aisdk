/**
 * @fileoverview Simple validation for AI client input.
 *
 * Uses loose validation — only checks structure and types, not ranges.
 * Range validation is handled by coerce.js which clamps values silently.
 */

/**
 * @typedef {Object} AskParams
 * @property {string} model
 * @property {string} apikey
 * @property {string} [prompt]
 * @property {string} [system]
 * @property {import('../index.js').Message[]} [messages]
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {number} [topP]
 * @property {number} [topK]
 * @property {number} [frequencyPenalty]
 * @property {number} [presencePenalty]
 * @property {number} [seed]
 * @property {string|string[]} [stop]
 * @property {string[]} [fallbacks]
 * @property {Record<string, unknown>} [providerOptions]
 */

/**
 * Validates ask() options structure and types.
 * @param {AskParams} params
 * @returns {void}
 * @throws {Error}
 */
export const validateAskOptions = (params) => {
  const errors = []

  // Required fields
  if (!params.model || typeof params.model !== 'string') {
    errors.push('"model" must be a non-empty string')
  }

  if (!params.apikey || typeof params.apikey !== 'string') {
    errors.push('"apikey" must be a non-empty string')
  }

  // Either prompt or messages must be provided (but not both required)
  if (params.prompt === undefined && params.messages === undefined) {
    errors.push('either "prompt" or "messages" must be provided')
  }

  // When using messages, system can still be provided (will be prepended)
  if (params.prompt !== undefined && (typeof params.prompt !== 'string' || params.prompt.trim() === '')) {
    errors.push('"prompt" must be a non-empty string')
  }

  // Optional string fields
  if (params.system !== undefined && typeof params.system !== 'string') {
    errors.push('"system" must be a string')
  }

  // Optional number fields
  const numberFields = ['temperature', 'maxTokens', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty', 'seed']
  for (const field of numberFields) {
    if (params[field] !== undefined && typeof params[field] !== 'number') {
      errors.push(`"${field}" must be a number`)
    }
  }

  // Optional array fields
  if (params.messages !== undefined) {
    if (!Array.isArray(params.messages)) {
      errors.push('"messages" must be an array')
    } else {
      params.messages.forEach((msg, i) => {
        if (!msg || typeof msg !== 'object') {
          errors.push(`messages[${i}] must be an object`)
        } else if (!['user', 'assistant', 'system'].includes(msg.role)) {
          errors.push(`messages[${i}].role must be 'user', 'assistant', or 'system'`)
        } else if (typeof msg.content !== 'string' || msg.content.trim() === '') {
          errors.push(`messages[${i}].content must be a non-empty string`)
        }
      })
    }
  }

  if (params.fallbacks !== undefined) {
    if (!Array.isArray(params.fallbacks)) {
      errors.push('"fallbacks" must be an array')
    } else {
      params.fallbacks.forEach((model, i) => {
        if (typeof model !== 'string') {
          errors.push(`fallbacks[${i}] must be a string`)
        }
      })
    }
  }

  // stop can be string or array of strings
  if (params.stop !== undefined) {
    if (typeof params.stop !== 'string' && !Array.isArray(params.stop)) {
      errors.push('"stop" must be a string or array of strings')
    } else if (Array.isArray(params.stop)) {
      params.stop.forEach((s, i) => {
        if (typeof s !== 'string') {
          errors.push(`stop[${i}] must be a string`)
        }
      })
    }
  }

  // providerOptions must be an object
  if (params.providerOptions !== undefined &&
      (typeof params.providerOptions !== 'object' || params.providerOptions === null || Array.isArray(params.providerOptions))) {
    errors.push('"providerOptions" must be an object')
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
}
