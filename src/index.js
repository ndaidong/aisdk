/**
 * @fileoverview Thin AI client — single unified interface for text generation.
 *
 * @example Basic usage
 * import { createAi } from './index.js'
 *
 * const ai = createAi()
 * const result = await ai.ask({
 *   model: 'claude-sonnet-4-20250514',
 *   prompt: 'What is the capital of Vietnam?',
 *   temperature: 0.5,
 * })
 * console.log(result.text)
 * console.log(result.usage) // { inputTokens, outputTokens, cacheTokens, estimatedCost }
 *
 * @example With fallbacks
 * const result = await ai.ask({
 *   model: 'gpt-4o',
 *   prompt: '...',
 *   fallbacks: ['gpt-4o-mini', 'claude-haiku-4-5-20251001'],
 * })
 * if (result.model !== 'gpt-4o') {
 *   console.warn('Fell back to', result.model)
 * }
 *
 * @example Google provider-specific options
 * const result = await ai.ask({
 *   model: 'gemini-2.0-flash',
 *   prompt: '...',
 *   providerOptions: {
 *     safetySettings: [
 *       { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
 *     ],
 *     thinkingConfig: { thinkingBudget: 1024 },
 *   },
 * })
 */

import {
  getModel, listModels,
} from './registry.js'
import { normalizeConfig } from './config.js'
import { coerceConfig } from './coerce.js'
import { getAdapter } from './providers.js'
import {
  ProviderError, InputError, throwHttpError,
} from './errors.js'
import { validateAskOptions } from './validation.js'

export {
  ProviderError, InputError,
}

/**
 * @typedef {Object} AiOptions
 * @property {string} [gatewayUrl] - Optional AI gateway URL override
 */

/**
 * @typedef {Object} AskParams
 * @property {string} model                       - Model ID (must exist in models.json)
 * @property {string} prompt                      - The user message
 * @property {string} [system]                    - Optional system prompt
 * @property {string[]} [fallbacks]               - Ordered list of fallback model IDs
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
 * @property {number} estimatedCost   - In USD, based on models.json pricing
 */

/**
 * @typedef {Object} AskResult
 * @property {string} text
 * @property {string} model           - The model that actually responded (may differ if fallback was used)
 * @property {Usage} usage
 */

/** @type {Record<string, string>} */
const ENV_KEYS = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  dashscope: 'DASHSCOPE_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

/**
 * Reads the API key for a provider from environment variables.
 * @param {string} providerId
 * @returns {string}
 * @throws {Error}
 */
const resolveKey = (providerId) => {
  const envVar = ENV_KEYS[providerId]
  const key = process.env[envVar]
  if (!key) {
    throw new Error(`Missing env var: ${envVar}`)
  }
  return key
}

/**
 * Picks generation config keys from AskParams, dropping routing params.
 * @param {AskParams} params
 * @returns {import('./config.js').GenerationConfig}
 */
const extractGenConfig = (params) => {
  const keys = ['temperature', 'maxTokens', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty']
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
const callModel = async (modelId, params, gatewayUrl) => {
  const {
    record, supportedParams,
  } = getModel(modelId)
  const {
    provider: providerId, name: modelName,
  } = record

  const apiKey = resolveKey(providerId)
  const adapter = getAdapter(providerId)

  const genConfig = extractGenConfig(params)

  // Coerce values to provider's acceptable ranges (clamp, don't throw)
  const coerced = coerceConfig(genConfig, providerId)

  // Normalize to wire format
  const normalizedConfig = normalizeConfig(coerced, providerId, supportedParams, modelId)

  const {
    prompt, system, providerOptions = {},
  } = params

  /** @type {import('./providers.js').Message[]} */
  const messages = [
    ...(system ? [{
      role: 'system', content: system,
    }] : []),
    {
      role: 'user', content: prompt,
    },
  ]

  const url = gatewayUrl ?? adapter.url(modelName, apiKey)
  const body = adapter.buildBody(modelName, messages, normalizedConfig, providerOptions)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: adapter.headers(apiKey),
      body: JSON.stringify(body),
    })
  } catch (networkErr) {
    // Network-level failure (DNS, connection refused) — treat as provider error
    throw new ProviderError(`Network error calling ${providerId}/${modelId}: ${networkErr.message}`, {
      status: 0,
      provider: providerId,
      model: modelId,
    })
  }

  if (!res.ok) {
    await throwHttpError(res, providerId, modelId)
  }

  const data = await res.json()
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
  const { gatewayUrl } = opts

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
    // Validate input structure and types
    try {
      await validateAskOptions(params)
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

    for (const modelId of chain) {
      try {
        return await callModel(modelId, params, gatewayUrl)
      } catch (err) {
        if (err instanceof InputError) {
          // Input errors are not fallback-able — rethrow immediately
          throw err
        }
        // ProviderError — log and try next model in chain
        console.warn(
          `[ai-client] ${err.message}. ${modelId === chain.at(-1) ? 'No more fallbacks.' : 'Trying next fallback...'}`
        )
        lastProviderError = err
      }
    }

    throw lastProviderError
  }

  return {
    ask, listModels,
  }
}
