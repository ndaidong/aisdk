/**
 * @fileoverview Per-provider param clamping.
 *
 * Coerces generation config values to each provider's acceptable ranges.
 * Instead of throwing errors, values are silently clamped to min/max bounds
 * with a console.warn for visibility.
 *
 * Uses the merged WIRE_KEYS config from config.js for range information.
 */

import { getWireMap } from './config.js'

/**
 * @typedef {import('./registry.js').ProviderId} ProviderId
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * Coerce config values to provider's acceptable ranges.
 * Logs warnings for clamped values.
 *
 * @param {Record<string, unknown>} config
 * @param {ProviderId} providerId
 * @returns {Record<string, unknown>}
 */
export const coerceConfig = (config, providerId) => {
  const wireMap = getWireMap(providerId)
  if (!wireMap) {
    return config
  }

  const result = { ...config }

  for (const [key, value] of Object.entries(config)) {
    const descriptor = wireMap[key]
    const range = descriptor?.range
    if (!range || typeof value !== 'number') {
      continue
    }

    const clamped = clamp(value, range.min, range.max)
    if (clamped !== value) {
      console.warn(
        `[ai-client] "${key}" value ${value} out of range for ${providerId}, clamped to ${clamped}`
      )
      result[key] = clamped
    }
  }

  return result
}
