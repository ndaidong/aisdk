/**
 * @fileoverview Security utilities for @pwshub/aisdk
 *
 * Provides API key validation, sanitization for logging,
 * and other security-related functions.
 */

import { InputError } from './errors.js'

/**
 * Sensitive field patterns to redact from logs
 * @type {string[]}
 */
const SENSITIVE_KEYS = [
  'apikey',
  'api_key',
  'apiKey',
  'authorization',
  'key',
  'token',
  'secret',
  'password',
  'credential',
]

/**
 * Sanitizes an object for safe logging by removing/masking sensitive fields
 * @param {unknown} obj - The object to sanitize
 * @returns {unknown} Sanitized object safe for logging
 */
export const sanitizeForLogging = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging)
  }

  const sanitized = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Provider-specific API key format patterns for validation warnings
 * @type {Record<string, {pattern: RegExp, message: string}>}
 */
const API_KEY_PATTERNS = {
  openai: {
    pattern: /^sk-[a-zA-Z0-9]{20,}/,
    message: 'OpenAI API key format looks incorrect (should start with sk-)',
  },
  anthropic: {
    pattern: /^sk-ant-[a-zA-Z0-9_-]{20,}/i,
    message: 'Anthropic API key format looks incorrect (should start with sk-ant-)',
  },
  google: {
    pattern: /^AIza[0-9A-Za-z_-]{35}/,
    message: 'Google API key format looks incorrect (should start with AIza)',
  },
  deepseek: {
    pattern: /^sk-[a-zA-Z0-9]{20,}/,
    message: 'DeepSeek API key format looks incorrect (should start with sk-)',
  },
  mistral: {
    pattern: /^[a-zA-Z0-9]{32,}/,
    message: 'Mistral API key format looks incorrect',
  },
  dashscope: {
    pattern: /^sk-[a-zA-Z0-9]{20,}/,
    message: 'DashScope API key format looks incorrect (should start with sk-)',
  },
  ollama: {
    // Ollama doesn't require API keys, so no validation
    pattern: /.*/,
    message: '',
  },
}

/**
 * Validates API key format per provider
 * @param {string} apikey - The API key to validate
 * @param {string} provider - The provider ID
 * @param {import('./logger.js').Logger} logger - Logger instance for warnings
 * @throws {InputError} When API key is missing or empty
 */
export const validateApiKey = (apikey, provider, logger) => {
  // Check if API key is provided and not empty
  if (!apikey || typeof apikey !== 'string' || apikey.trim() === '') {
    throw new InputError('API key is required', {
      status: 401,
      provider,
      model: 'unknown',
    })
  }

  // Provider-specific format warnings (not throwing, just warning)
  const providerWarning = API_KEY_PATTERNS[provider]
  if (providerWarning && providerWarning.message && !providerWarning.pattern.test(apikey)) {
    logger.warn(`[ai-client] ${providerWarning.message}`)
  }
}