/**
 * @fileoverview Model registry — loads from a Directus-exported JSON array.
 *
 * The JSON is an array of model records matching the Directus collection schema.
 * It is indexed by model ID at load time for O(1) lookups at runtime.
 *
 * `supportedParams` is optional per record. When absent, the provider's
 * default param set is used. This allows the field to be added to Directus
 * incrementally without breaking anything.
 *
 * To update: export from Directus → replace models.json (no conversion needed).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  join, dirname, resolve,
} from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// models.json is in the project root, one level up from src/
const PROJECT_ROOT = resolve(__dirname, '..')

/**
 * @typedef {'openai'|'anthropic'|'google'|'dashscope'|'deepseek'} ProviderId
 */

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
}

/**
 * Loads the models.json array and indexes it by model ID.
 * Sync read is intentional — runs once at module init, not per-request.
 *
 * @returns {Map<string, ModelRecord>}
 */
const loadRegistry = () => {
  const filePath = join(PROJECT_ROOT, 'models.json')
  let rows

  try {
    rows = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    throw new Error(`Failed to load model registry from ${filePath}: ${err.message}`)
  }

  if (!Array.isArray(rows)) {
    throw new Error(`models.json must be a JSON array. Got: ${typeof rows}`)
  }

  return new Map(rows.map((row) => [row.id, row]))
}

/** @type {Map<string, ModelRecord>} */
const REGISTRY = loadRegistry()

/**
 * Looks up a model by ID, validates it is enabled, and resolves its
 * effective supported params (record-level override or provider default).
 *
 * @param {string} modelId
 * @returns {{ record: ModelRecord, supportedParams: string[] }}
 * @throws {Error} When the model is not found or is disabled
 */
export const getModel = (modelId) => {
  const record = REGISTRY.get(modelId)

  if (!record) {
    const available = [...REGISTRY.keys()].join(', ')
    throw new Error(`Unknown model "${modelId}". Available: ${available}`)
  }

  if (!record.enable) {
    throw new Error(`Model "${modelId}" is currently disabled.`)
  }

  const supportedParams = record.supportedParams ?? PROVIDER_DEFAULT_PARAMS[record.provider]

  return {
    record, supportedParams,
  }
}

/**
 * Returns all enabled model records.
 *
 * @returns {ModelRecord[]}
 */
export const listModels = () =>
  [...REGISTRY.values()].filter((m) => m.enable)
