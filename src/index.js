/**
 * @fileoverview Thin AI client — single unified interface for text generation.
 *
 * @example Basic usage
 * import { createAi } from '@pwshub/aisdk'
 *
 * const ai = createAi()
 * const result = await ai.ask({
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   apikey: 'your-api-key',
 *   prompt: 'What is the capital of Vietnam?',
 *   temperature: 0.5,
 * })
 * console.log(result.text)
 * console.log(result.usage) // { inputTokens, outputTokens, cacheTokens, reasoningTokens, estimatedCost }
 *
 * @example With fallbacks
 * const result = await ai.ask({
 *   model: 'openai/gpt-4o',
 *   apikey: 'your-openai-key',
 *   prompt: '...',
 *   fallbacks: ['openai/gpt-4o-mini', 'anthropic/claude-haiku-4-5-20251001'],
 * })
 * if (result.model !== 'openai/gpt-4o') {
 *   console.warn('Fell back to', result.model)
 * }
 *
 * @example Google provider-specific options
 * const result = await ai.ask({
 *   model: 'google/gemini-2.0-flash',
 *   apikey: 'your-google-key',
 *   prompt: '...',
 *   providerOptions: {
 *     safetySettings: [
 *       { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
 *     ],
 *     thinkingConfig: { thinkingBudget: 1024 },
 *   },
 * })
 *
 * @example Using messages array for multi-turn conversations
 * const result = await ai.ask({
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   apikey: 'your-api-key',
 *   messages: [
 *     { role: 'user', content: 'What is the capital of Vietnam?' },
 *     { role: 'assistant', content: 'The capital of Vietnam is Hanoi.' },
 *     { role: 'user', content: 'What is its population?' },
 *   ],
 * })
 *
 */

import {
  getModel, createRegistry,
} from './registry.js'
import { normalizeConfig } from './config.js'
import { coerceConfig } from './coerce.js'
import { getAdapter } from './providers.js'
import {
  ProviderError, InputError, throwHttpError,
} from './errors.js'
import { validateAskOptions } from './validation.js'
import { getLogger, setLogger, noopLogger } from './logger.js'
import { validateApiKey } from './security.js'

export {
  ProviderError, InputError,
  setLogger, noopLogger, getLogger,
}

export { addModels, setModels, listModels, createRegistry } from './registry.js'
/**
 * @typedef {Object} HookContext
 * @property {string} model - Model identifier
 * @property {string} provider - Provider ID
 * @property {string} url - Request URL
 * @property {Record<string, string>} headers - Request headers
 * @property {Record<string, unknown>} body - Request body
 */

/**
 * @typedef {Object} ResponseHookContext
 * @property {string} model - Model identifier
 * @property {string} provider - Provider ID
 * @property {string} url - Request URL
 * @property {Record<string, string>} headers - Request headers
 * @property {Record<string, unknown>} body - Request body
 * @property {number} status - Response status code
 * @property {unknown} data - Response data
 * @property {number} duration - Request duration in milliseconds
 */

/**
 * @typedef {Object} AiOptions
 * @property {string} [gatewayUrl] - Optional AI gateway URL override
 * @property {number} [timeout] - Request timeout in milliseconds (default: 30000)
 * @property {import('./models.js').ModelRecord[]} [models] - Custom model registry
 * @property {(context: HookContext) => void | Promise<void>} [onRequest] - Hook called before each request
 * @property {(context: ResponseHookContext) => void | Promise<void>} [onResponse] - Hook called after each response
 */

/**
 * @typedef {Object} AskParams
 * @property {string} model                       - Model name or 'provider/name' format (e.g., 'gpt-4o', 'ollama/llama3.2')
 * @property {string} apikey                      - API key for the provider
 * @property {string} [prompt]                    - The user message (alternative to messages)
 * @property {string} [system]                    - Optional system prompt (used with prompt)
 * @property {import('./providers.js').Message[]} [messages] - Array of messages with role and content (alternative to prompt)
 * @property {string[]} [fallbacks]               - Ordered list of fallback models (same format as model)
 * @property {Record<string, unknown>} [providerOptions] - Provider-specific options merged into body
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {number} [topP]
 * @property {number} [topK]
 * @property {number} [frequencyPenalty]
 * @property {number} [presencePenalty]
 */

/**
 * @typedef {Object} Usage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} cacheTokens
 * @property {number} reasoningTokens
 * @property {number} estimatedCost   - In USD, based on models.json pricing
 */

/**
 * @typedef {Object} AskResult
 * @property {string} text
 * @property {string} model           - The model that actually responded (may differ if fallback was used)
 * @property {Usage} usage
 */

/**
 * Picks generation config keys from AskParams, dropping routing params.
 * @param {AskParams} params
 * @returns {import('./config.js').GenerationConfig}
 */
const extractGenConfig = (params) => {
  const keys = ['temperature', 'maxTokens', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty', 'stop', 'seed']
  return Object.fromEntries(
    keys.filter((k) => params[k] !== undefined).map((k) => [k, params[k]])
  )
}

/**
 * Calculates estimated cost in USD from token counts and model pricing.
 *
 * @param {import('./registry.js').RawUsage} usage
 * @param {import('./registry.js').ModelRecord} record
 * @returns {number}
 */
const calcCost = (usage, record) => {
  const M = 1_000_000
  const inputCost = (usage.inputTokens / M) * record.input_price
  // Don't add reasoningTokens - they're already included in outputTokens
  // reasoningTokens is for informational/tracking purposes only
  const outputCost = (usage.outputTokens / M) * record.output_price
  const cacheCost = (usage.cacheTokens / M) * record.cache_price

  // Round to 8 decimal places to avoid floating point noise
  return Math.round((inputCost + outputCost + cacheCost) * 1e8) / 1e8
}

/**
 * Sends a single request to a provider. No retry logic — throws structured
 * errors so the caller (ask) can decide how to handle them.
 *
 * @param {string} modelId
 * @param {AskParams} params
 * @param {string} [gatewayUrl]
 * @returns {Promise<AskResult>}
 * @throws {ProviderError} On 429 / 5xx — safe to retry or fallback
 * @throws {InputError} On 4xx — do not retry, fix the input
 */
const callModel = async (modelId, params, gatewayUrl, registry = null, timeout = 30000, hooks = {}) => {
  const logger = getLogger()
  const { onRequest, onResponse } = hooks

  // Use provided registry instance or fall back to global getModel
  const modelLookup = registry ? registry.getModel : getModel
  const {
    record, supportedParams, paramOverrides,
  } = modelLookup(modelId)
  const {
    provider: providerId, name: modelName,
  } = record

  const { apikey } = params

  // Validate API key before making request
  validateApiKey(apikey, providerId, logger)

  const adapter = getAdapter(providerId)

  const genConfig = extractGenConfig(params)

  // Coerce values to provider's acceptable ranges (clamp, don't throw)
  // Pass model-specific param overrides
  const { coerced } = coerceConfig(genConfig, providerId, {
    modelId,
    overrides: paramOverrides,
  })

  // Normalize to wire format
  const normalizedConfig = normalizeConfig(coerced, providerId, supportedParams, modelId)

  const {
    prompt, system, messages, providerOptions = {},
  } = params

  /** @type {import('./providers.js').Message[]} */
  const messageList = messages ?? [
    ...(system ? [{
      role: 'system', content: system,
    }] : []),
    {
      role: 'user', content: prompt,
    },
  ]

  const url = adapter.url(modelName, apikey, gatewayUrl)
  const requestHeaders = adapter.headers(apikey)
  const body = adapter.buildBody(modelName, messageList, normalizedConfig, providerOptions)

  // Invoke onRequest hook
  if (onRequest) {
    await onRequest({
      model: modelId,
      provider: providerId,
      url,
      headers: requestHeaders,
      body,
    })
  }

  let res
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const startTime = Date.now()

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (networkErr) {
    clearTimeout(timeoutId)

    // Network-level failure (DNS, connection refused) — treat as provider error
    logger.warn(
      `[ai-client] Network error calling ${providerId}/${modelId}: ${networkErr.message}`
    )

    if (networkErr.name === 'AbortError') {
      throw new ProviderError(`Request timeout after ${timeout}ms`, {
        status: 408,
        provider: providerId,
        model: modelId,
      })
    }

    throw new ProviderError(`Network error calling ${providerId}/${modelId}`, {
      status: 0,
      provider: providerId,
      model: modelId,
    })
  }

  clearTimeout(timeoutId)

  if (!res.ok) {
    await throwHttpError(res, providerId, modelId, logger)
  }

  const data = await res.json()
  const duration = Date.now() - startTime

  // Invoke onResponse hook
  if (onResponse) {
    await onResponse({
      model: modelId,
      provider: providerId,
      url,
      headers: requestHeaders,
      body,
      status: res.status,
      data,
      duration,
    })
  }

  const rawUsage = adapter.extractUsage(data)

  /** @type {Usage} */
  const usage = {
    ...rawUsage,
    estimatedCost: calcCost(rawUsage, record),
  }

  return {
    text: adapter.extractText(data),
    model: modelId,
    usage,
  }
}

/**
 * Creates a thin AI client.
 *
 * No internal retry — the caller controls retry strategy and can track
 * attempt counts and errors externally. Fallbacks are provider-error-only:
 * input errors (bad request, auth) are thrown immediately without trying
 * fallback models.
 *
 * @param {AiOptions} [opts={}]
 * @returns {{ ask: (params: AskParams) => Promise<AskResult>, listModels: () => import('./registry.js').ModelRecord[] }}
 */
export const createAi = (opts = {}) => {
  const { gatewayUrl, models, timeout, onRequest, onResponse } = opts
  // Create isolated registry instance for this AI client
  const registry = models
    ? createRegistry(models)
    : createRegistry()

  /**
   * Sends a text generation request, with optional fallback chain.
   * Retrying is the caller's responsibility.
   *
   * @param {AskParams} params
   * @returns {Promise<AskResult>}
   * @throws {ProviderError} When all models in the chain fail with provider errors
   * @throws {InputError} Immediately, without trying fallbacks
   */
  const ask = async (params) => {
    const logger = getLogger()

    // Validate input structure and types
    try {
      validateAskOptions(params)
    } catch (error) {
      throw new InputError('Invalid options', {
        status: 400,
        provider: 'client',
        model: params.model || 'unknown',
        raw: error.message,
      })
    }

    const chain = [params.model, ...(params.fallbacks ?? [])]
    let lastProviderError
    const hooks = { onRequest, onResponse }

    for (const modelId of chain) {
      try {
        return await callModel(modelId, params, gatewayUrl, registry, timeout, hooks)
      } catch (err) {
        if (err instanceof InputError) {
          // Input errors are not fallback-able — rethrow immediately
          throw err
        }
        // ProviderError — log and try next model in chain
        logger.warn(
          `[ai-client] ${err.message}. ${modelId === chain.at(-1) ? 'No more fallbacks.' : 'Trying next fallback...'}`
        )
        lastProviderError = err
      }
    }

    throw lastProviderError
  }

  return {
    ask,
    listModels: () => registry.listModels(),
    addModels: (m) => registry.addModels(m),
  }
}
