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
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.temperature, 2)
    })

    it('should clamp temperature below range', () => {
      const config = { temperature: -1 }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.temperature, 0)
    })

    it('should not clamp temperature within range', () => {
      const config = { temperature: 1 }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.temperature, 1)
    })

    it('should clamp topP to valid range [0, 1]', () => {
      const config = { topP: 1.5 }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.topP, 1)
    })

    it('should clamp frequencyPenalty to valid range [-2, 2]', () => {
      const config = { frequencyPenalty: 3 }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.frequencyPenalty, 2)
    })

    it('should clamp presencePenalty to valid range [-2, 2]', () => {
      const config = { presencePenalty: -3 }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.presencePenalty, -2)
    })
  })

  describe('anthropic', () => {
    it('should clamp temperature to valid range [0, 1]', () => {
      const config = { temperature: 1.5 }
      const result = coerceConfig(config, 'anthropic')
      assert.strictEqual(result.temperature, 1)
    })

    it('should clamp topK to valid range [1, 100]', () => {
      const config = { topK: 150 }
      const result = coerceConfig(config, 'anthropic')
      assert.strictEqual(result.topK, 100)
    })

    it('should clamp topK below range', () => {
      const config = { topK: 0 }
      const result = coerceConfig(config, 'anthropic')
      assert.strictEqual(result.topK, 1)
    })
  })

  describe('google', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 3 }
      const result = coerceConfig(config, 'google')
      assert.strictEqual(result.temperature, 2)
    })

    it('should clamp topK to valid range [1, 100]', () => {
      const config = { topK: 200 }
      const result = coerceConfig(config, 'google')
      assert.strictEqual(result.topK, 100)
    })
  })

  describe('dashscope', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 5 }
      const result = coerceConfig(config, 'dashscope')
      assert.strictEqual(result.temperature, 2)
    })

    it('should clamp topP to valid range [0, 1]', () => {
      const config = { topP: 2 }
      const result = coerceConfig(config, 'dashscope')
      assert.strictEqual(result.topP, 1)
    })
  })

  describe('deepseek', () => {
    it('should clamp temperature to valid range [0, 2]', () => {
      const config = { temperature: 3 }
      const result = coerceConfig(config, 'deepseek')
      assert.strictEqual(result.temperature, 2)
    })

    it('should clamp frequencyPenalty to valid range [-2, 2]', () => {
      const config = { frequencyPenalty: 5 }
      const result = coerceConfig(config, 'deepseek')
      assert.strictEqual(result.frequencyPenalty, 2)
    })
  })

  describe('edge cases', () => {
    it('should return config unchanged for unknown provider', () => {
      const config = { temperature: 100 }
      const result = coerceConfig(config, 'unknown')
      assert.strictEqual(result.temperature, 100)
    })

    it('should not clamp non-numeric values', () => {
      const config = { temperature: 'hot' }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.temperature, 'hot')
    })

    it('should handle empty config', () => {
      const result = coerceConfig({}, 'openai')
      assert.deepStrictEqual(result, {})
    })

    it('should clamp multiple values at once', () => {
      const config = {
        temperature: 5,
        topP: 2,
        maxTokens: 100,
      }
      const result = coerceConfig(config, 'openai')
      assert.strictEqual(result.temperature, 2)
      assert.strictEqual(result.topP, 1)
      assert.strictEqual(result.maxTokens, 100) // maxTokens has no range
    })
  })
})
