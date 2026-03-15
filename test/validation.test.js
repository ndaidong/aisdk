/**
 * @fileoverview Tests for validation module.
 */

import {
  describe, it,
} from 'node:test'
import assert from 'node:assert'
import { validateAskOptions } from '../src/validation.js'

describe('validateAskOptions', () => {
  describe('required fields', () => {
    it('should pass with valid model, apikey and prompt', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key', prompt: 'Hello',
        })
      })
    })

    it('should throw when model is missing', () => {
      assert.throws(
        () => validateAskOptions({
          apikey: 'test-key', prompt: 'Hello',
        }),
        /"model" must be a non-empty string/
      )
    })

    it('should throw when model is empty string', () => {
      assert.throws(
        () => validateAskOptions({
          model: '', apikey: 'test-key', prompt: 'Hello',
        }),
        /"model" must be a non-empty string/
      )
    })

    it('should throw when model is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 123, apikey: 'test-key', prompt: 'Hello',
        }),
        /"model" must be a non-empty string/
      )
    })

    it('should throw when apikey is missing', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', prompt: 'Hello',
        }),
        /"apikey" must be a non-empty string/
      )
    })

    it('should throw when apikey is empty string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: '', prompt: 'Hello',
        }),
        /"apikey" must be a non-empty string/
      )
    })

    it('should throw when apikey is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 123, prompt: 'Hello',
        }),
        /"apikey" must be a non-empty string/
      )
    })

    it('should throw when prompt and messages are both missing', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
        }),
        /either "prompt" or "messages" must be provided/
      )
    })

    it('should pass with empty string prompt', () => {
      assert.doesNotThrow(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key', prompt: '',
        })
      )
    })

    it('should throw when prompt is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key', prompt: 123,
        }),
        /"prompt" must be a string/
      )
    })

    it('should pass with valid messages array', () => {
      assert.doesNotThrow(
        () => validateAskOptions({
          model: 'gpt-4o',
          apikey: 'test-key',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        })
      )
    })

    it('should throw when messages is not an array', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key', messages: 'not-array',
        }),
        /"messages" must be an array/
      )
    })

    it('should throw when messages has invalid role', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o',
          apikey: 'test-key',
          messages: [{ role: 'invalid', content: 'test' }],
        }),
        /messages\[0\]\.role must be 'user', 'assistant', or 'system'/
      )
    })

    it('should throw when messages has missing content', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o',
          apikey: 'test-key',
          messages: [{ role: 'user' }],
        }),
        /messages\[0\]\.content must be a string/
      )
    })
  })

  describe('optional string fields', () => {
    it('should pass with valid system prompt', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          system: 'You are helpful',
        })
      })
    })

    it('should throw when system is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          system: 123,
        }),
        /"system" must be a string/
      )
    })
  })

  describe('optional number fields', () => {
    it('should pass with valid temperature', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          temperature: 0.5,
        })
      })
    })

    it('should throw when temperature is not a number', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          temperature: 'hot',
        }),
        /"temperature" must be a number/
      )
    })

    it('should pass with valid maxTokens', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          maxTokens: 100,
        })
      })
    })

    it('should throw when maxTokens is not a number', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          maxTokens: '100',
        }),
        /"maxTokens" must be a number/
      )
    })

    it('should pass with all optional number fields', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          temperature: 0.5,
          maxTokens: 100,
          topP: 0.9,
          topK: 50,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          seed: 42,
        })
      })
    })
  })

  describe('messages array', () => {
    it('should pass with valid messages', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          messages: [
            {
              role: 'user', content: 'Hi',
            },
            {
              role: 'assistant', content: 'Hello!',
            },
            {
              role: 'system', content: 'Be helpful',
            },
          ],
        })
      })
    })

    it('should throw when messages is not an array', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          messages: 'not an array',
        }),
        /"messages" must be an array/
      )
    })

    it('should throw when message role is invalid', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          messages: [{
            role: 'bot', content: 'Hi',
          }],
        }),
        /messages\[0\].role must be 'user', 'assistant', or 'system'/
      )
    })

    it('should throw when message content is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          messages: [{
            role: 'user', content: 123,
          }],
        }),
        /messages\[0\].content must be a string/
      )
    })
  })

  describe('fallbacks array', () => {
    it('should pass with valid fallbacks', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          fallbacks: ['gpt-4o-mini', 'claude-sonnet'],
        })
      })
    })

    it('should throw when fallbacks is not an array', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          fallbacks: 'not an array',
        }),
        /"fallbacks" must be an array/
      )
    })

    it('should throw when fallback item is not a string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          fallbacks: [123],
        }),
        /fallbacks\[0\] must be a string/
      )
    })
  })

  describe('stop field', () => {
    it('should pass with string stop', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          stop: 'END',
        })
      })
    })

    it('should pass with array of strings stop', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          stop: ['END', 'STOP'],
        })
      })
    })

    it('should throw when stop is not string or array', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          stop: 123,
        }),
        /"stop" must be a string or array of strings/
      )
    })

    it('should throw when stop array contains non-string', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          stop: ['END', 123],
        }),
        /stop\[1\] must be a string/
      )
    })
  })

  describe('providerOptions field', () => {
    it('should pass with valid providerOptions object', () => {
      assert.doesNotThrow(() => {
        validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          providerOptions: { safetySettings: [] },
        })
      })
    })

    it('should throw when providerOptions is not an object', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          providerOptions: 'not an object',
        }),
        /"providerOptions" must be an object/
      )
    })

    it('should throw when providerOptions is an array', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          providerOptions: [],
        }),
        /"providerOptions" must be an object/
      )
    })

    it('should throw when providerOptions is null', () => {
      assert.throws(
        () => validateAskOptions({
          model: 'gpt-4o', apikey: 'test-key',
          prompt: 'Hello',
          providerOptions: null,
        }),
        /"providerOptions" must be an object/
      )
    })
  })
})
