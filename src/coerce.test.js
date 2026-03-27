/**
 * @fileoverview Tests for coerce module.
 */

import {
  describe, it,
} from 'node:test'
import assert from 'node:assert'
import { coerceConfig } from '../src/coerce.js'

describe('coerceConfig', () => {
  describe('openai', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 3 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.temperature, 2)
    })

    it('should clamp temperature below range', () => {
      const config = { temperature: -1 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.temperature, 0)
    })

    it('should not clamp temperature within range', () => {
      const config = { temperature: 1 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.temperature, 1)
    })

    it('should clamp topP to valid range [0, 1]', () => {
      const config = { topP: 1.5 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.topP, 1)
    })

    it('should clamp frequencyPenalty to valid range [-2, 2]', () => {
      const config = { frequencyPenalty: 3 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.frequencyPenalty, 2)
    })

    it('should clamp presencePenalty to valid range [-2, 2]', () => {
      const config = { presencePenalty: -3 }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.presencePenalty, -2)
    })
  })

  describe('anthropic', () => {
    it('should clamp temperature to valid range [0, 1]', () => {
      const config = { temperature: 1.5 }
      const { coerced } = coerceConfig(config, 'anthropic')
      assert.strictEqual(coerced.temperature, 1)
    })

    it('should clamp topK to valid range [1, 100]', () => {
      const config = { topK: 150 }
      const { coerced } = coerceConfig(config, 'anthropic')
      assert.strictEqual(coerced.topK, 100)
    })

    it('should clamp topK below range', () => {
      const config = { topK: 0 }
      const { coerced } = coerceConfig(config, 'anthropic')
      assert.strictEqual(coerced.topK, 1)
    })
  })

  describe('google', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 3 }
      const { coerced } = coerceConfig(config, 'google')
      assert.strictEqual(coerced.temperature, 2)
    })

    it('should clamp topK to valid range [1, 100]', () => {
      const config = { topK: 200 }
      const { coerced } = coerceConfig(config, 'google')
      assert.strictEqual(coerced.topK, 100)
    })
  })

  describe('dashscope', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 5 }
      const { coerced } = coerceConfig(config, 'dashscope')
      assert.strictEqual(coerced.temperature, 2)
    })

    it('should clamp topP to valid range [0, 1]', () => {
      const config = { topP: 2 }
      const { coerced } = coerceConfig(config, 'dashscope')
      assert.strictEqual(coerced.topP, 1)
    })
  })

  describe('deepseek', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 3 }
      const { coerced } = coerceConfig(config, 'deepseek')
      assert.strictEqual(coerced.temperature, 2)
    })

    it('should clamp frequencyPenalty to valid range [-2, 2]', () => {
      const config = { frequencyPenalty: 5 }
      const { coerced } = coerceConfig(config, 'deepseek')
      assert.strictEqual(coerced.frequencyPenalty, 2)
    })
  })

  describe('edge cases', () => {
    it('should return config unchanged for unknown provider', () => {
      const config = { temperature: 100 }
      const { coerced } = coerceConfig(config, 'unknown')
      assert.strictEqual(coerced.temperature, 100)
    })

    it('should not clamp non-numeric values', () => {
      const config = { temperature: 'hot' }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.temperature, 'hot')
    })

    it('should handle empty config', () => {
      const { coerced, dropped } = coerceConfig({}, 'openai')
      assert.deepStrictEqual({ coerced, dropped }, { coerced: {}, dropped: [] })
    })

    it('should clamp multiple values at once', () => {
      const config = {
        temperature: 5,
        topP: 2,
        maxTokens: 100,
      }
      const { coerced } = coerceConfig(config, 'openai')
      assert.strictEqual(coerced.temperature, 2)
      assert.strictEqual(coerced.topP, 1)
      assert.strictEqual(coerced.maxTokens, 100) // maxTokens has no range
    })
  })

  describe('fixedValue overrides', () => {
    it('should force temperature to fixedValue', () => {
      const config = { temperature: 0.5 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/gpt-5-nano',
        overrides: {
          temperature: { fixedValue: 1 },
        },
      })
      assert.strictEqual(coerced.temperature, 1)
    })

    it('should not change value if it already matches fixedValue', () => {
      const config = { temperature: 1 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/gpt-5-nano',
        overrides: {
          temperature: { fixedValue: 1 },
        },
      })
      assert.strictEqual(coerced.temperature, 1)
    })

    it('should force multiple params to fixed values', () => {
      const config = { temperature: 0.5, topP: 0.8 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/gpt-5-nano',
        overrides: {
          temperature: { fixedValue: 1 },
          topP: { fixedValue: 1 },
        },
      })
      assert.strictEqual(coerced.temperature, 1)
      assert.strictEqual(coerced.topP, 1)
    })
  })

  describe('supportedValues (discrete values)', () => {
    it('should clamp to nearest supported value', () => {
      const config = { temperature: 0.3 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/some-model',
        overrides: {
          temperature: { supportedValues: [0, 0.5, 1] },
        },
      })
      assert.strictEqual(coerced.temperature, 0.5)
    })

    it('should not change value if it matches a supported value', () => {
      const config = { temperature: 0.5 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/some-model',
        overrides: {
          temperature: { supportedValues: [0, 0.5, 1] },
        },
      })
      assert.strictEqual(coerced.temperature, 0.5)
    })
  })

  describe('range overrides', () => {
    it('should use overridden range instead of default', () => {
      const config = { temperature: 3 }
      const { coerced } = coerceConfig(config, 'openai', {
        modelId: 'openai/some-model',
        overrides: {
          temperature: { range: { min: 0, max: 0.5 } },
        },
      })
      assert.strictEqual(coerced.temperature, 0.5)
    })
  })
})
