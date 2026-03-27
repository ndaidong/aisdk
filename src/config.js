/**
 * @fileoverview Generation config normalizer.
 *
 * Validates canonical camelCase params against the model's supportedParams list
 * (from registry), warns on unsupported ones, then translates to provider
 * wire-format keys.
 *
 * Wire-key mappings are defined per-provider here. Google additionally needs
 * some params nested under `generationConfig`.
 */

/**
 * @typedef {import('./registry.js').ProviderId} ProviderId
 */

/**
 * @typedef {Object} GenerationConfig
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {number} [topP]
 * @property {number} [topK]
 * @property {number} [frequencyPenalty]
 * @property {number} [presencePenalty]
 * @property {number} [randomSeed]
 */

/**
 * @typedef {Object} ParamRange
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {Object} WireDescriptor
 * @property {string} wireKey
 * @property {'root'|'generationConfig'} [scope] - Google nests some params
 * @property {ParamRange} [range] - Valid range for the param (for clamping)
 * @property {number[]} [supportedValues] - Discrete allowed values (e.g. [1] for fixed temp)
 * @property {number} [fixedValue] - Force param to this value regardless of input
 */

/**
 * Wire-key translation table per provider.
 * Only lists params that exist for that provider.
 * Includes range info for param clamping.
 *
 * @type {Record<ProviderId, Record<string, WireDescriptor>>}
 */
const WIRE_KEYS = {
  openai: {
    maxTokens: { wireKey: 'max_completion_tokens' },
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 2,
      },
      // Note: Some OpenAI models (e.g. gpt-5-nano) only support fixedValue: 1
      // Model-specific overrides are handled in coerce.js via registry overrides
    },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    frequencyPenalty: {
      wireKey: 'frequency_penalty', range: {
        min: -2, max: 2,
      },
    },
    presencePenalty: {
      wireKey: 'presence_penalty', range: {
        min: -2, max: 2,
      },
    },
    stop: { wireKey: 'stop' },
    seed: { wireKey: 'seed' },
    // https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
  },
  anthropic: {
    maxTokens: { wireKey: 'max_tokens' },
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 1,
      },
    },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    topK: {
      wireKey: 'top_k', range: {
        min: 1, max: 100,
      },
    },
    stop: { wireKey: 'stop_sequences' },
  },
  google: {
    temperature: {
      wireKey: 'temperature', scope: 'generationConfig', range: {
        min: 0, max: 2,
      },
    },
    maxTokens: {
      wireKey: 'maxOutputTokens', scope: 'generationConfig',
    },
    topP: {
      wireKey: 'topP', scope: 'generationConfig', range: {
        min: 0, max: 1,
      },
    },
    topK: {
      wireKey: 'topK', scope: 'generationConfig', range: {
        min: 1, max: 100,
      },
    },
    stop: { wireKey: 'stopSequences', scope: 'generationConfig' },
    seed: { wireKey: 'seed', scope: 'generationConfig' },
  },
  dashscope: {
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 2,
      },
    },
    maxTokens: { wireKey: 'max_tokens' },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    topK: {
      wireKey: 'top_k', range: {
        min: 1, max: 100,
      },
    },
    stop: { wireKey: 'stop' },
  },
  deepseek: {
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 2,
      },
    },
    maxTokens: { wireKey: 'max_tokens' },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    frequencyPenalty: {
      wireKey: 'frequency_penalty', range: {
        min: -2, max: 2,
      },
    },
    presencePenalty: {
      wireKey: 'presence_penalty', range: {
        min: -2, max: 2,
      },
    },
    stop: { wireKey: 'stop' },
  },
  mistral: {
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 2,
      },
    },
    maxTokens: { wireKey: 'max_tokens' },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    randomSeed: { wireKey: 'random_seed' },
    stop: { wireKey: 'stop' },
  },
  ollama: {
    temperature: {
      wireKey: 'temperature', range: {
        min: 0, max: 2,
      },
    },
    maxTokens: { wireKey: 'num_predict' },
    topP: {
      wireKey: 'top_p', range: {
        min: 0, max: 1,
      },
    },
    topK: { wireKey: 'top_k' },
    seed: { wireKey: 'seed' },
    stop: { wireKey: 'stop' },
  },
}

/**
 * Normalizes a GenerationConfig to provider wire format, using the model's
 * `supportedParams` list as the source of truth for what's allowed.
 *
 * - Params not in `supportedParams` → console.warn + drop
 * - Params in `supportedParams` → translate to provider wire key
 * - Google params with scope 'generationConfig' → nested automatically
 *
 * @param {GenerationConfig} config
 * @param {ProviderId} providerId
 * @param {string[]} supportedParams  - From the model's registry entry
 * @param {string} modelId            - Used in warning messages
 * @returns {Record<string, unknown>}
 */
export const normalizeConfig = (config, providerId, supportedParams, modelId) => {
  const wireMap = WIRE_KEYS[providerId]
  const supported = new Set(supportedParams)
  const root = {}
  const generationConfig = {}

  for (const [canonicalKey, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      continue
    }

    if (!supported.has(canonicalKey)) {
      console.warn(
        `[ai-client] "${canonicalKey}" is not supported by model "${modelId}" — skipping.`
      )
      continue
    }

    const descriptor = wireMap[canonicalKey]
    if (!descriptor) {
      continue
    } // paranoia guard — should not happen if registry is correct

    if (descriptor.scope === 'generationConfig') {
      generationConfig[descriptor.wireKey] = value
    } else {
      root[descriptor.wireKey] = value
    }
  }

  if (Object.keys(generationConfig).length > 0) {
    root.generationConfig = generationConfig
  }

  return root
}

/**
 * Returns the wire-key map for a provider.
 * Used by coerce.js for param range validation.
 * @param {ProviderId} providerId
 * @returns {Record<string, WireDescriptor>}
 */
export const getWireMap = (providerId) => WIRE_KEYS[providerId]
