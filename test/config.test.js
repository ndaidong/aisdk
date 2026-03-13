/**
 * @fileoverview Tests for config module.
 */

import {
  describe, it,
} from 'node:test'
import assert from 'node:assert'
import {
  normalizeConfig, getWireMap,
} from '../src/config.js'

describe('config', () => {
  describe('getWireMap', () => {
    it('should return wire map for openai', () => {
      const wireMap = getWireMap('openai')
      assert.ok(wireMap)
      assert.ok(wireMap.temperature)
      assert.strictEqual(wireMap.temperature.wireKey, 'temperature')
    })

    it('should return wire map for anthropic', () => {
      const wireMap = getWireMap('anthropic')
      assert.ok(wireMap)
      assert.ok(wireMap.temperature)
      assert.strictEqual(wireMap.temperature.wireKey, 'temperature')
    })

    it('should return wire map for google', () => {
      const wireMap = getWireMap('google')
      assert.ok(wireMap)
      assert.ok(wireMap.temperature)
      assert.strictEqual(wireMap.temperature.wireKey, 'temperature')
      assert.strictEqual(wireMap.temperature.scope, 'generationConfig')
    })

    it('should return wire map for dashscope', () => {
      const wireMap = getWireMap('dashscope')
      assert.ok(wireMap)
      assert.ok(wireMap.temperature)
      assert.strictEqual(wireMap.temperature.wireKey, 'temperature')
    })

    it('should return wire map for deepseek', () => {
      const wireMap = getWireMap('deepseek')
      assert.ok(wireMap)
      assert.ok(wireMap.temperature)
      assert.strictEqual(wireMap.temperature.wireKey, 'temperature')
    })

    it('should return undefined for unknown provider', () => {
      const wireMap = getWireMap('unknown')
      assert.strictEqual(wireMap, undefined)
    })
  })

  describe('normalizeConfig', () => {
    it('should normalize openai config', () => {
      const config = {
        temperature: 0.5,
        maxTokens: 100,
        topP: 0.9,
      }
      const supportedParams = ['temperature', 'maxTokens', 'topP']
      const result = normalizeConfig(config, 'openai', supportedParams, 'gpt-4o')

      assert.strictEqual(result.temperature, 0.5)
      assert.strictEqual(result.max_completion_tokens, 100)
      assert.strictEqual(result.top_p, 0.9)
    })

    it('should normalize anthropic config', () => {
      const config = {
        temperature: 0.5,
        maxTokens: 100,
        topK: 50,
      }
      const supportedParams = ['temperature', 'maxTokens', 'topK']
      const result = normalizeConfig(config, 'anthropic', supportedParams, 'claude-sonnet')

      assert.strictEqual(result.temperature, 0.5)
      assert.strictEqual(result.max_tokens, 100)
      assert.strictEqual(result.top_k, 50)
    })

    it('should normalize google config with generationConfig nesting', () => {
      const config = {
        temperature: 0.5,
        maxTokens: 100,
        topP: 0.9,
      }
      const supportedParams = ['temperature', 'maxTokens', 'topP']
      const result = normalizeConfig(config, 'google', supportedParams, 'gemini-2.0-flash')

      assert.strictEqual(result.temperature, undefined)
      assert.strictEqual(result.maxTokens, undefined)
      assert.strictEqual(result.topP, undefined)
      assert.ok(result.generationConfig)
      assert.strictEqual(result.generationConfig.temperature, 0.5)
      assert.strictEqual(result.generationConfig.maxOutputTokens, 100)
      assert.strictEqual(result.generationConfig.topP, 0.9)
    })

    it('should skip unsupported params', () => {
      const config = {
        temperature: 0.5,
        topK: 50, // openai doesn't support topK
      }
      const supportedParams = ['temperature']
      const result = normalizeConfig(config, 'openai', supportedParams, 'gpt-4o')

      assert.strictEqual(result.temperature, 0.5)
      assert.strictEqual(result.top_k, undefined)
    })

    it('should skip null/undefined values', () => {
      const config = {
        temperature: 0.5,
        maxTokens: null,
        topP: undefined,
      }
      const supportedParams = ['temperature', 'maxTokens', 'topP']
      const result = normalizeConfig(config, 'openai', supportedParams, 'gpt-4o')

      assert.strictEqual(result.temperature, 0.5)
      assert.strictEqual(result.max_completion_tokens, undefined)
      assert.strictEqual(result.top_p, undefined)
    })

    it('should return empty object when no config provided', () => {
      const result = normalizeConfig({}, 'openai', ['temperature'], 'gpt-4o')
      assert.deepStrictEqual(result, {})
    })

    it('should return empty object when no supported params match', () => {
      const config = { unknownParam: 123 }
      const supportedParams = ['temperature']
      const result = normalizeConfig(config, 'openai', supportedParams, 'gpt-4o')
      assert.deepStrictEqual(result, {})
    })
  })
})
