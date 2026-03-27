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
 * @property {Record<string, import('./coerce.js').ParamOverride>} [paramOverrides] - Model-specific param overrides
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

/**
 * Creates a new registry instance with the given models
 * @param {import('./models.js').ModelRecord[]} [initialModels] - Initial models to load (defaults to DEFAULT_MODELS)
 * @returns {{
 *   getModel: (modelId: string) => { record: ModelRecord, supportedParams: string[], paramOverrides: Record<string, import('./coerce.js').ParamOverride> },
 *   listModels: () => ModelRecord[],
 *   addModels: (models: ModelRecord[]) => void,
 *   setModels: (models: ModelRecord[]) => void
 * }}
 */
export const createRegistry = (initialModels = DEFAULT_MODELS) => {
  /** @type {Map<string, ModelRecord>} */
  let REGISTRY = new Map(initialModels.map((model) => {
    const normalized = normalizeModelRecord(model)
    return [normalized.id, normalized]
  }))

  /**
   * Looks up a model by provider/name format.
   * @param {string} modelId - Model in 'provider/name' format
   * @returns {{ record: ModelRecord, supportedParams: string[], paramOverrides: Record<string, import('./coerce.js').ParamOverride> }}
   */
  const getModel = (modelId) => {
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

    for (const m of REGISTRY.values()) {
      if (m.name === name && m.provider === provider) {
        const record = m

        if (!record.enable) {
          throw new Error(`Model "${record.provider}/${record.name}" is currently disabled.`)
        }

        const supportedParams = record.supportedParams ?? PROVIDER_DEFAULT_PARAMS[record.provider]
        const paramOverrides = record.paramOverrides ?? {}

        return {
          record, supportedParams, paramOverrides,
        }
      }
    }

    const available = [...REGISTRY.values()].map(m => `${m.provider}/${m.name}`).join(', ')
    throw new Error(`Unknown model "${modelId}". Available: ${available}`)
  }

  /**
   * Returns all enabled model records.
   * @returns {ModelRecord[]}
   */
  const listModels = () =>
    [...REGISTRY.values()].filter((m) => m.enable)

  /**
   * Adds one or more models to the registry.
   * @param {ModelRecord[]} models - Array of model records to add
   */
  const addModels = (models) => {
    if (!Array.isArray(models)) {
      throw new Error(`addModels expects an array. Got: ${typeof models}`)
    }

    models.forEach((model, index) => {
      validateModelRecord(model, index)
    })

    models.forEach((model) => {
      const normalized = normalizeModelRecord(model)
      REGISTRY.set(normalized.id, normalized)
    })
  }

  /**
   * Replaces the entire registry with a new list of models.
   * @param {ModelRecord[]} models - Array of model records
   */
  const setModels = (models) => {
    if (!Array.isArray(models)) {
      throw new Error(`setModels expects an array. Got: ${typeof models}`)
    }

    models.forEach((model, index) => {
      validateModelRecord(model, index)
    })

    REGISTRY = new Map(models.map((model) => {
      const normalized = normalizeModelRecord(model)
      return [normalized.id, normalized]
    }))
  }

  return { getModel, listModels, addModels, setModels }
}

/** @type {Map<string, ModelRecord>} */
let REGISTRY = new Map()

/**
 * Initializes the global registry with default models.
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

  // Check optional paramOverrides if present
  if (model.paramOverrides !== undefined) {
    if (typeof model.paramOverrides !== 'object' || model.paramOverrides === null || Array.isArray(model.paramOverrides)) {
      errors.push('"paramOverrides" must be an object')
    } else {
      for (const [param, override] of Object.entries(model.paramOverrides)) {
        if (typeof override !== 'object' || override === null) {
          errors.push(`"paramOverrides.${param}" must be an object`)
        } else {
          // Check that override has at least one valid property
          const validKeys = ['fixedValue', 'supportedValues', 'range']
          const hasValidKey = Object.keys(override).some((k) => validKeys.includes(k))
          if (!hasValidKey) {
            errors.push(`"paramOverrides.${param}" must have at least one of: ${validKeys.join(', ')}`)
          }
          // Validate fixedValue type
          if (override.fixedValue !== undefined && typeof override.fixedValue !== 'number') {
            errors.push(`"paramOverrides.${param}.fixedValue" must be a number`)
          }
          // Validate supportedValues type
          if (override.supportedValues !== undefined) {
            if (!Array.isArray(override.supportedValues)) {
              errors.push(`"paramOverrides.${param}.supportedValues" must be an array`)
            } else {
              override.supportedValues.forEach((v, i) => {
                if (typeof v !== 'number') {
                  errors.push(`"paramOverrides.${param}.supportedValues[${i}]" must be a number`)
                }
              })
            }
          }
          // Validate range type
          if (override.range !== undefined) {
            if (typeof override.range !== 'object' || override.range === null) {
              errors.push(`"paramOverrides.${param}.range" must be an object`)
            } else if (typeof override.range.min !== 'number' || typeof override.range.max !== 'number') {
              errors.push(`"paramOverrides.${param}.range" must have numeric min and max`)
            }
          }
        }
      }
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
    ...(model.paramOverrides !== undefined && { paramOverrides: model.paramOverrides }),
  }
}

/**
 * Gets a model from the global registry (for backward compatibility).
 * For isolated registries, use the getModel from createRegistry() instead.
 *
 * @param {string} modelId - Model in 'provider/name' format
 * @returns {{ record: ModelRecord, supportedParams: string[], paramOverrides: Record<string, import('./coerce.js').ParamOverride> }}
 */
export const getModel = (modelId) => {
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

  for (const m of REGISTRY.values()) {
    if (m.name === name && m.provider === provider) {
      const record = m

      if (!record.enable) {
        throw new Error(`Model "${record.provider}/${record.name}" is currently disabled.`)
      }

      const supportedParams = record.supportedParams ?? PROVIDER_DEFAULT_PARAMS[record.provider]
      const paramOverrides = record.paramOverrides ?? {}

      return {
        record, supportedParams, paramOverrides,
      }
    }
  }

  const available = [...REGISTRY.values()].map(m => `${m.provider}/${m.name}`).join(', ')
  throw new Error(`Unknown model "${modelId}". Available: ${available}`)
}

/**
 * Returns all enabled model records from the global registry.
 * For isolated registries, use the listModels from createRegistry() instead.
 *
 * @returns {ModelRecord[]}
 */
export const listModels = () =>
  [...REGISTRY.values()].filter((m) => m.enable)

/**
 * Adds one or more models to the global registry.
 * For isolated registries, use the addModels from createRegistry() instead.
 *
 * @param {ModelRecord[]} models - Array of model records to add
 */
export const addModels = (models) => {
  if (!Array.isArray(models)) {
    throw new Error(`addModels expects an array. Got: ${typeof models}`)
  }

  models.forEach((model, index) => {
    validateModelRecord(model, index)
  })

  models.forEach((model) => {
    const normalized = normalizeModelRecord(model)
    REGISTRY.set(normalized.id, normalized)
  })
}

/**
 * Replaces the entire global registry with a new list of models.
 * For isolated registries, use the setModels from createRegistry() instead.
 *
 * @param {ModelRecord[]} models - Array of model records
 */
export const setModels = (models) => {
  if (!Array.isArray(models)) {
    throw new Error(`setModels expects an array. Got: ${typeof models}`)
  }

  models.forEach((model, index) => {
    validateModelRecord(model, index)
  })

  REGISTRY = new Map(models.map((model) => {
    const normalized = normalizeModelRecord(model)
    return [normalized.id, normalized]
  }))
}
