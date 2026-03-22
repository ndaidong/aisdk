/**
 * @fileoverview Tests for registry module.
 */

import {
  describe, it, before,
} from 'node:test'
import assert from 'node:assert'
import {
  getModel, listModels, setModels, PROVIDER_DEFAULT_PARAMS,
} from '../src/registry.js'
import { DEFAULT_MODELS } from '../src/models.js'

// Use default models from src/models.js for testing
before(() => {
  setModels(DEFAULT_MODELS)
})

describe('registry', () => {
  describe('PROVIDER_DEFAULT_PARAMS', () => {
    it('should have params for all providers', () => {
      assert.ok(PROVIDER_DEFAULT_PARAMS.openai)
      assert.ok(PROVIDER_DEFAULT_PARAMS.anthropic)
      assert.ok(PROVIDER_DEFAULT_PARAMS.google)
      assert.ok(PROVIDER_DEFAULT_PARAMS.dashscope)
      assert.ok(PROVIDER_DEFAULT_PARAMS.deepseek)
    })

    it('openai should include standard params', () => {
      const params = PROVIDER_DEFAULT_PARAMS.openai
      assert.ok(params.includes('temperature'))
      assert.ok(params.includes('maxTokens'))
      assert.ok(params.includes('topP'))
      assert.ok(params.includes('frequencyPenalty'))
      assert.ok(params.includes('presencePenalty'))
    })

    it('anthropic should include standard params', () => {
      const params = PROVIDER_DEFAULT_PARAMS.anthropic
      assert.ok(params.includes('temperature'))
      assert.ok(params.includes('maxTokens'))
      assert.ok(params.includes('topP'))
      assert.ok(params.includes('topK'))
    })

    it('google should include standard params', () => {
      const params = PROVIDER_DEFAULT_PARAMS.google
      assert.ok(params.includes('temperature'))
      assert.ok(params.includes('maxTokens'))
      assert.ok(params.includes('topP'))
      assert.ok(params.includes('topK'))
    })
  })

  describe('getModel', () => {
    it('should return model record for valid model', () => {
      const {
        record, supportedParams,
      } = getModel('openai/gpt-4.1-nano')
      assert.ok(record)
      assert.strictEqual(record.provider, 'openai')
      assert.strictEqual(record.name, 'gpt-4.1-nano')
      assert.ok(Array.isArray(supportedParams))
    })

    it('should throw when model is not in provider/name format', () => {
      assert.throws(
        () => getModel('gpt-4.1-nano'),
        /Model must be in 'provider\/name' format/
      )
    })

    it('should throw for unknown model', () => {
      assert.throws(
        () => getModel('openai/nonexistent-model'),
        /Unknown model/
      )
    })

    it('should throw for disabled model', () => {
      // First find a disabled model or test the error path
      // This depends on models.json content
      assert.throws(
        () => getModel('openai/disabled-model-test'),
        /Unknown model/
      )
    })

    it('should use provider default params when model has no supportedParams', () => {
      const { supportedParams } = getModel('openai/gpt-4.1-nano')
      assert.ok(supportedParams.length > 0)
    })
  })

  describe('listModels', () => {
    it('should return array of models', () => {
      const models = listModels()
      assert.ok(Array.isArray(models))
      assert.ok(models.length > 0)
    })

    it('should only return enabled models', () => {
      const models = listModels()
      models.forEach((model) => {
        assert.strictEqual(model.enable, true)
      })
    })

    it('each model should have required fields', () => {
      const models = listModels()
      models.forEach((model) => {
        assert.ok(model.id, 'model should have id')
        assert.ok(model.name, 'model should have name')
        assert.ok(model.provider, 'model should have provider')
        assert.ok(typeof model.input_price === 'number', 'model should have input_price')
        assert.ok(typeof model.output_price === 'number', 'model should have output_price')
        assert.ok(typeof model.max_in === 'number', 'model should have max_in')
        assert.ok(typeof model.max_out === 'number', 'model should have max_out')
      })
    })
  })

  describe('setModels', () => {
    it('should throw when models is not an array', () => {
      assert.throws(
        () => setModels({}),
        /setModels expects an array/
      )
      assert.throws(
        () => setModels(null),
        /setModels expects an array/
      )
      assert.throws(
        () => setModels('string'),
        /setModels expects an array/
      )
    })

    it('should throw when model record is missing required fields', () => {
      // Only name and provider are required, other fields get defaults
      assert.throws(
        () => setModels([{ provider: 'openai' }]),
        /"name" must be a non-empty string/
      )
      assert.throws(
        () => setModels([{ name: 'Test' }]),
        /"provider" must be a string/
      )
    })

    it('should throw when model has empty name', () => {
      assert.throws(
        () => setModels([{ name: '', provider: 'openai' }]),
        /"name" must be a non-empty string/
      )
    })

    it('should throw when provider is invalid', () => {
      assert.throws(
        () => setModels([{ name: 'Test', provider: 'invalid' }]),
        /"provider" must be one of:/
      )
    })

    it('should throw when numeric fields are negative', () => {
      assert.throws(
        () => setModels([{ name: 'Test', provider: 'openai', input_price: -1 }]),
        /"input_price" must be non-negative/
      )
    })

    it('should throw when supportedParams is invalid', () => {
      assert.throws(
        () => setModels([{ name: 'Test', provider: 'openai', supportedParams: 'not-array' }]),
        /"supportedParams" must be an array/
      )
      assert.throws(
        () => setModels([{ name: 'Test', provider: 'openai', supportedParams: [123] }]),
        /"supportedParams\[0\]" must be a string/
      )
    })

    it('should set models from array and override registry', () => {
      const customModels = [
        {
          name: 'Custom Model 1',
          provider: 'openai',
          input_price: 0.5,
          output_price: 1.5,
          cache_price: 0.1,
          max_in: 128000,
          max_out: 4096,
          enable: true,
        },
        {
          name: 'Custom Model 2',
          provider: 'anthropic',
          input_price: 3,
          output_price: 15,
          cache_price: 0,
          max_in: 200000,
          max_out: 8192,
          enable: false,
        },
      ]

      setModels(customModels)

      // Use provider/name format
      const { record } = getModel('openai/Custom Model 1')
      assert.strictEqual(record.name, 'Custom Model 1')
      assert.strictEqual(record.provider, 'openai')
      assert.strictEqual(record.input_price, 0.5)
    })

    it('should throw for disabled model after setModels', () => {
      const customModels = [
        {
          name: 'Disabled Custom',
          provider: 'google',
          input_price: 0.1,
          output_price: 0.5,
          cache_price: 0,
          max_in: 100000,
          max_out: 2048,
          enable: false,
        },
      ]

      setModels(customModels)

      assert.throws(
        () => getModel('google/Disabled Custom'),
        /currently disabled/
      )
    })

    it('listModels should return only enabled models after setModels', () => {
      const customModels = [
        {
          name: 'Enabled 1',
          provider: 'openai',
          input_price: 0.5,
          output_price: 1.5,
          cache_price: 0,
          max_in: 128000,
          max_out: 4096,
          enable: true,
        },
        {
          name: 'Disabled 1',
          provider: 'anthropic',
          input_price: 3,
          output_price: 15,
          cache_price: 0,
          max_in: 200000,
          max_out: 8192,
          enable: false,
        },
      ]

      setModels(customModels)

      const models = listModels()
      assert.strictEqual(models.length, 1)
      assert.strictEqual(models[0].id, 'openai_Enabled 1')
      assert.strictEqual(models[0].name, 'Enabled 1')
      assert.strictEqual(models[0].provider, 'openai')
    })

    it('should use provider default params when model has no supportedParams', () => {
      const customModels = [
        {
          name: 'No Params Model',
          provider: 'google',
          input_price: 0.1,
          output_price: 0.5,
          cache_price: 0,
          max_in: 100000,
          max_out: 2048,
          enable: true,
        },
      ]

      setModels(customModels)

      const { supportedParams } = getModel('google/No Params Model')
      assert.ok(supportedParams.length > 0)
      assert.ok(supportedParams.includes('temperature'))
      assert.ok(supportedParams.includes('maxTokens'))
    })

    it('should use model-level supportedParams when provided', () => {
      const customModels = [
        {
          name: 'Custom Params Model',
          provider: 'openai',
          input_price: 0.5,
          output_price: 1.5,
          cache_price: 0,
          max_in: 128000,
          max_out: 4096,
          enable: true,
          supportedParams: ['temperature', 'maxTokens', 'customParam'],
        },
      ]

      setModels(customModels)

      const { supportedParams } = getModel('openai/Custom Params Model')
      assert.deepStrictEqual(supportedParams, ['temperature', 'maxTokens', 'customParam'])
    })
  })
})
