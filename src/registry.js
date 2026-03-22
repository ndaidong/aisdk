/**
 * @fileoverview Model registry — in-memory store for model records.
 *
 * Default models are loaded automatically from ./models.js at import time.
 * Users can modify the registry via addModels() and setModels().
 *
 * This module provides O(1) lookups at runtime via a Map.
 * Models can be looked up by name, or by provider/name format.
 *
 * `supportedParams` is optional per record. When absent, the provider's
 * default param set is used.
 *
 * @typedef {'openai'|'anthropic'|'google'|'dashscope'|'deepseek'} ProviderId
 */

import { DEFAULT_MODELS } from './models.js'

/**
 * Mirrors the Directus collection schema exactly.
 * `supportedParams` is optional — added later via Directus field.
 *
 * @typedef {Object} ModelRecord
 * @property {string} id
 * @property {string} name                  - Official model name used in API calls
 * @property {ProviderId} provider
 * @property {number} input_price           - Per 1M tokens, USD
 * @property {number} output_price          - Per 1M tokens, USD
 * @property {number} cache_price           - Per 1M tokens, USD
 * @property {number} max_in                - Max input tokens (context window)
 * @property {number} max_out               - Max output tokens
 * @property {boolean} enable
 * @property {string[]} [supportedParams]   - Canonical param names; falls back to provider default
 */

/**
 * Default supported params per provider.
 * Used as fallback when a model record has no `supportedParams` field.
 *
 * @type {Record<ProviderId, string[]>}
 */
export const PROVIDER_DEFAULT_PARAMS = {
  openai: ['temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'seed', 'stop'],
  anthropic: ['temperature', 'maxTokens', 'topP', 'topK', 'stop'],
  google: ['temperature', 'maxTokens', 'topP', 'topK', 'seed', 'stop'],
  dashscope: ['temperature', 'maxTokens', 'topP', 'topK', 'stop'],
  deepseek: ['temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'stop'],
  mistral: ['temperature', 'maxTokens', 'topP', 'randomSeed', 'stop'],
  ollama: ['temperature', 'maxTokens', 'topP', 'topK', 'seed', 'stop'],
}

/** @type {ProviderId[]} */
const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'dashscope', 'deepseek', 'mistral', 'ollama']

/** @type {Map<string, ModelRecord>} */
let REGISTRY = new Map()

/**
 * Initializes the registry with default models.
 * Called automatically at module import.
 */
const initRegistry = () => {
  REGISTRY = new Map(DEFAULT_MODELS.map((model) => [model.id, model]))
}

// Initialize with default models on import
initRegistry()

/**
 * Validates a single model record structure and types.
 *
 * @param {Object} model - The model record to validate
 * @param {number} index - Index in the array for error messages
 * @throws {Error} When validation fails
 */
const validateModelRecord = (model, index) => {
  const errors = []

  // Only name and provider are required
  if (!model.name || typeof model.name !== 'string') {
    errors.push('"name" must be a non-empty string')
  }

  if (!model.provider || typeof model.provider !== 'string') {
    errors.push('"provider" must be a string')
  } else if (!VALID_PROVIDERS.includes(model.provider)) {
    errors.push(`"provider" must be one of: ${VALID_PROVIDERS.join(', ')}. Got: "${model.provider}"`)
  }

  // Check optional number fields if present (must be non-negative)
  const numberFields = ['input_price', 'output_price', 'cache_price', 'max_in', 'max_out']
  for (const field of numberFields) {
    if (model[field] !== undefined && typeof model[field] !== 'number') {
      errors.push(`"${field}" must be a number`)
    } else if (model[field] !== undefined && model[field] < 0) {
      errors.push(`"${field}" must be non-negative, got: ${model[field]}`)
    }
  }

  // Check optional enable if present
  if (model.enable !== undefined && typeof model.enable !== 'boolean') {
    errors.push('"enable" must be a boolean')
  }

  // Check optional supportedParams if present
  if (model.supportedParams !== undefined) {
    if (!Array.isArray(model.supportedParams)) {
      errors.push('"supportedParams" must be an array')
    } else {
      model.supportedParams.forEach((param, i) => {
        if (typeof param !== 'string') {
          errors.push(`"supportedParams[${i}]" must be a string`)
        }
      })
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid model record at index ${index}: ${errors.join('; ')}`)
  }
}

/**
 * Normalizes a model record by setting defaults for missing fields.
 * Generates id from provider and name if not provided.
 *
 * @param {Object} model - The model record to normalize
 * @returns {ModelRecord} Normalized model record
 */
const normalizeModelRecord = (model) => {
  return {
    id: model.id || `${model.provider}_${model.name}`,
    name: model.name,
    provider: model.provider,
    input_price: model.input_price ?? 0,
    output_price: model.output_price ?? 0,
    cache_price: model.cache_price ?? 0,
    max_in: model.max_in ?? 32000,
    max_out: model.max_out ?? 8000,
    enable: model.enable ?? true,
    ...(model.supportedParams !== undefined && { supportedParams: model.supportedParams }),
  }
}

/**
 * Looks up a model by provider/name format.
 * Validates it is enabled, and resolves its effective supported params.
 *
 * @param {string} modelId - Model in 'provider/name' format (e.g., 'openai/gpt-4o', 'ollama/llama3.2')
 * @returns {{ record: ModelRecord, supportedParams: string[] }}
 * @throws {Error} When the model is not found or is disabled
 */
export const getModel = (modelId) => {
  // Require provider/name format
  if (!modelId.includes('/')) {
    const available = [...REGISTRY.values()].map(m => `${m.provider}/${m.name}`).join(', ')
    throw new Error(`Model must be in 'provider/name' format. Got: "${modelId}". Available: ${available}`)
  }
  
  const parts = modelId.split('/')
  if (parts.length !== 2) {
    const available = [...REGISTRY.values()].map(m => `${m.provider}/${m.name}`).join(', ')
    throw new Error(`Model must be in 'provider/name' format. Got: "${modelId}". Available: ${available}`)
  }
  
  const [provider, name] = parts
  
  // Search for model by name and provider
  for (const m of REGISTRY.values()) {
    if (m.name === name && m.provider === provider) {
      const record = m
      
      if (!record.enable) {
        throw new Error(`Model "${record.provider}/${record.name}" is currently disabled.`)
      }

      const supportedParams = record.supportedParams ?? PROVIDER_DEFAULT_PARAMS[record.provider]

      return {
        record, supportedParams,
      }
    }
  }
  
  const available = [...REGISTRY.values()].map(m => `${m.provider}/${m.name}`).join(', ')
  throw new Error(`Unknown model "${modelId}". Available: ${available}`)
}

/**
 * Returns all enabled model records.
 *
 * @returns {ModelRecord[]}
 */
export const listModels = () =>
  [...REGISTRY.values()].filter((m) => m.enable)

/**
 * Adds one or more models to the registry.
 * Existing models with the same ID are overwritten.
 *
 * @param {ModelRecord[]} models - Array of model records to add
 * @throws {Error} When models is not an array or contains invalid records
 */
export const addModels = (models) => {
  if (!Array.isArray(models)) {
    throw new Error(`addModels expects an array. Got: ${typeof models}`)
  }

  // Validate and normalize each model record
  models.forEach((model, index) => {
    validateModelRecord(model, index)
  })

  // Add normalized models to the registry
  models.forEach((model) => {
    const normalized = normalizeModelRecord(model)
    REGISTRY.set(normalized.id, normalized)
  })
}

/**
 * Replaces the entire model registry with a new list of models.
 * Use this to load models from a CMS or other external source.
 *
 * @param {ModelRecord[]} models - Array of model records
 * @throws {Error} When models is not an array or contains invalid records
 */
export const setModels = (models) => {
  if (!Array.isArray(models)) {
    throw new Error(`setModels expects an array. Got: ${typeof models}`)
  }

  // Validate and normalize each model record
  models.forEach((model, index) => {
    validateModelRecord(model, index)
  })

  REGISTRY = new Map(models.map((model) => {
    const normalized = normalizeModelRecord(model)
    return [normalized.id, normalized]
  }))
}
