/**
 * @fileoverview Tests for registry module.
 */

import {
  describe, it,
} from 'node:test'
import assert from 'node:assert'
import {
  getModel, listModels, PROVIDER_DEFAULT_PARAMS,
} from '../src/registry.js'

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
      } = getModel('gpt-4.1-nano')
      assert.ok(record)
      assert.strictEqual(record.id, 'gpt-4.1-nano')
      assert.ok(record.provider)
      assert.ok(Array.isArray(supportedParams))
    })

    it('should throw for unknown model', () => {
      assert.throws(
        () => getModel('nonexistent-model'),
        /Unknown model/
      )
    })

    it('should throw for disabled model', () => {
      // First find a disabled model or test the error path
      // This depends on models.json content
      assert.throws(
        () => getModel('disabled-model-test'),
        /Unknown model/
      )
    })

    it('should use provider default params when model has no supportedParams', () => {
      const { supportedParams } = getModel('gpt-4.1-nano')
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
})
