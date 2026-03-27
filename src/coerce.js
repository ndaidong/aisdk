/**
 * @fileoverview Per-provider param clamping.
 *
 * Coerces generation config values to each provider's acceptable ranges.
 * Instead of throwing errors, values are silently clamped to min/max bounds
 * with a console.warn for visibility.
 *
 * Uses the merged WIRE_KEYS config from config.js for range information.
 * Also supports model-specific overrides via the overrides parameter.
 */

import { getWireMap } from './config.js'

/**
 * @typedef {import('./registry.js').ProviderId} ProviderId
 */

/**
 * @typedef {Object} ParamOverride
 * @property {number} [fixedValue] - Force param to this value
 * @property {number[]} [supportedValues] - Only allow these discrete values
 * @property {{min: number, max: number}} [range] - Override the default range
 */

/**
 * @typedef {Object} CoerceOptions
 * @property {string} modelId - Model identifier for override lookup
 * @property {Record<string, ParamOverride>} [overrides] - Model-specific param overrides
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * Coerce config values to provider's acceptable ranges.
 * Logs warnings for clamped or dropped values.
 *
 * @param {Record<string, unknown>} config
 * @param {ProviderId} providerId
 * @param {CoerceOptions} [options]
 * @returns {{ coerced: Record<string, unknown>, dropped: string[] }}
 */
export const coerceConfig = (config, providerId, options = {}) => {
  const { modelId, overrides = {} } = options
  const wireMap = getWireMap(providerId)
  if (!wireMap) {
    return { coerced: config, dropped: [] }
  }

  const result = { ...config }
  const dropped = []

  for (const [key, value] of Object.entries(config)) {
    const descriptor = wireMap[key]
    const override = overrides[key]
    if (!descriptor && !override) {
      continue
    }

    // Merge descriptor and override (override takes precedence)
    const effectiveDescriptor = {
      ...descriptor,
      ...override,
      range: override?.range || descriptor?.range,
    }

    // Handle fixedValue: force param to specific value
    if (effectiveDescriptor.fixedValue !== undefined && typeof value === 'number') {
      if (value !== effectiveDescriptor.fixedValue) {
        console.warn(
          `[ai-client] "${key}" value ${value} not supported by model "${modelId}", forced to ${effectiveDescriptor.fixedValue}`
        )
        result[key] = effectiveDescriptor.fixedValue
      }
      continue
    }

    // Handle supportedValues: only allow discrete values
    if (effectiveDescriptor.supportedValues?.length && typeof value === 'number') {
      if (!effectiveDescriptor.supportedValues.includes(value)) {
        // Clamp to nearest supported value
        const nearest = effectiveDescriptor.supportedValues.reduce((prev, curr) =>
          Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        )
        console.warn(
          `[ai-client] "${key}" value ${value} not supported by model "${modelId}", clamped to nearest allowed ${nearest}`
        )
        result[key] = nearest
      }
      continue
    }

    // Handle range clamping (existing behavior)
    const range = effectiveDescriptor.range
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

  return { coerced: result, dropped }
}

/**
 * Drop params that are not supported by a model.
 * Used when provider returns an "unsupported_value" error.
 *
 * @param {Record<string, unknown>} config
 * @param {string[]} paramsToDrop
 * @returns {Record<string, unknown>}
 */
export const dropParams = (config, paramsToDrop) => {
  const result = { ...config }
  for (const param of paramsToDrop) {
    delete result[param]
  }
  return result
}
