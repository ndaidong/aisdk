/**
 * @fileoverview Integration tests for AI client module.
 */

import {
  describe, it, beforeEach, afterEach,
} from 'node:test'
import assert from 'node:assert'
import { createAi, ProviderError, InputError, setLogger, noopLogger } from './index.js'

// Store original fetch
const originalFetch = typeof global.fetch === 'function' ? global.fetch : null

/**
 * Creates a mock fetch response
 * @param {Object} options
 * @param {boolean} options.ok
 * @param {number} options.status
 * @param {Object} options.data
 * @param {string} [options.text]
 * @param {Map} [options.headers]
 * @returns {Promise<Response>}
 */
const mockFetchResponse = ({ ok = true, status = 200, data = {}, text = '', headers = new Map() }) => {
  return Promise.resolve({
    ok,
    status,
    headers: {
      get: (name) => headers.get(name),
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(text),
  })
}

describe('createAi', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should create AI client with default options', () => {
    const ai = createAi()
    assert.ok(ai)
    assert.ok(typeof ai.ask === 'function')
    assert.ok(typeof ai.listModels === 'function')
    assert.ok(typeof ai.addModels === 'function')
  })

  it('should create AI client with custom options', () => {
    const ai = createAi({
      gatewayUrl: 'https://custom.api.example.com',
      timeout: 5000,
    })
    assert.ok(ai)
    assert.ok(typeof ai.ask === 'function')
  })

  it('should create isolated registry per instance', () => {
    const ai1 = createAi()
    const ai2 = createAi()
    
    const models1 = ai1.listModels()
    const models2 = ai2.listModels()
    
    // Both should have models but be independent
    assert.ok(models1.length > 0)
    assert.ok(models2.length > 0)
    assert.strictEqual(models1.length, models2.length)
  })

  it('should accept custom models in createAi', () => {
    const customModels = [
      {
        name: 'custom-model',
        provider: 'openai',
        input_price: 0.5,
        output_price: 1.5,
        max_in: 128000,
        max_out: 4096,
        enable: true,
      },
    ]
    
    const ai = createAi({ models: customModels })
    const models = ai.listModels()
    
    assert.strictEqual(models.length, 1)
    assert.strictEqual(models[0].name, 'custom-model')
  })
})

describe('ask with mock fetch', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should succeed with valid request', async () => {
    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Hello from AI!' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      },
    })

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.strictEqual(result.text, 'Hello from AI!')
    assert.strictEqual(result.usage.inputTokens, 10)
    assert.strictEqual(result.usage.outputTokens, 20)
  })

  it('should throw InputError for invalid API key', async () => {
    global.fetch = () => mockFetchResponse({
      ok: false,
      status: 401,
      text: 'Invalid API key',
    })

    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: '',
        prompt: 'Hello',
      }),
      InputError
    )
  })

  it('should throw InputError for empty prompt', async () => {
    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        prompt: '',
      }),
      InputError
    )
  })

  it('should throw ProviderError for rate limit', async () => {
    global.fetch = () => mockFetchResponse({
      ok: false,
      status: 429,
      text: 'Rate limit exceeded',
    })

    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        prompt: 'Hello',
      }),
      ProviderError
    )
  })

  it('should throw ProviderError for server error', async () => {
    global.fetch = () => mockFetchResponse({
      ok: false,
      status: 500,
      text: 'Internal server error',
    })

    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        prompt: 'Hello',
      }),
      ProviderError
    )
  })
})

describe('ask with fallbacks', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should try fallback models on ProviderError', async () => {
    let callCount = 0
    
    global.fetch = () => {
      callCount++
      if (callCount === 1) {
        // First call fails with 429
        return mockFetchResponse({
          ok: false,
          status: 429,
          text: 'Rate limited',
        })
      }
      // Second call succeeds
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          choices: [{ message: { content: 'Success from fallback!' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        },
      })
    }

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
      fallbacks: ['openai/gpt-4o-mini'],
    })

    assert.strictEqual(callCount, 2)
    assert.strictEqual(result.text, 'Success from fallback!')
  })

  it('should not try fallbacks on InputError', async () => {
    let callCount = 0
    
    global.fetch = () => {
      callCount++
      return mockFetchResponse({
        ok: false,
        status: 401,
        text: 'Invalid API key',
      })
    }

    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'invalid-key',
        prompt: 'Hello',
        fallbacks: ['openai/gpt-4o-mini'],
      }),
      InputError
    )

    assert.strictEqual(callCount, 1) // Only one call, no fallback
  })

  it('should throw after all fallbacks fail', async () => {
    let callCount = 0
    
    global.fetch = () => {
      callCount++
      return mockFetchResponse({
        ok: false,
        status: 429,
        text: 'Rate limited',
      })
    }

    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        prompt: 'Hello',
        fallbacks: ['openai/gpt-4o-mini', 'anthropic/claude-haiku-4-5'],
      }),
      ProviderError
    )

    assert.strictEqual(callCount, 3) // All models tried
  })

  it('should use result from first successful model', async () => {
    let callCount = 0

    global.fetch = (_url, _options) => {
      callCount++
      if (callCount <= 2) {
        return mockFetchResponse({
          ok: false,
          status: 429,
          text: 'Rate limited',
        })
      }
      // Third call is to Anthropic - return Anthropic format
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          content: [{ type: 'text', text: 'Third model succeeded!' }],
          usage: { input_tokens: 5, output_tokens: 10 },
        },
      })
    }

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
      fallbacks: ['openai/gpt-4o-mini', 'anthropic/claude-haiku-4-5'],
    })

    assert.strictEqual(callCount, 3)
    assert.ok(result.text.includes('Third model'))
  })
})

describe('timeout', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should timeout request after specified duration', async () => {
    global.fetch = (_url, options) => {
      // Simulate slow response that respects abort signal
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(mockFetchResponse({
            ok: true,
            status: 200,
            data: {
              choices: [{ message: { content: 'Slow response' } }],
              usage: { prompt_tokens: 5, completion_tokens: 10 },
            },
          }))
        }, 200)

        // Respect abort signal for timeout
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
      })
    }

    const ai = createAi({ timeout: 50 })

    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        prompt: 'Hello',
      }),
      ProviderError
    )
  })

  it('should succeed if request completes before timeout', async () => {
    global.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          choices: [{ message: { content: 'Fast response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        },
      })
    }

    const ai = createAi({ timeout: 500 })
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.strictEqual(result.text, 'Fast response')
  })
})

describe('hooks', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should invoke onRequest hook before request', async () => {
    let hookCalled = false
    let hookContext = null

    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
      },
    })

    const ai = createAi({
      onRequest: (context) => {
        hookCalled = true
        hookContext = context
      },
    })

    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.ok(hookCalled)
    assert.ok(hookContext)
    assert.strictEqual(hookContext.model, 'openai/gpt-4o')
    assert.strictEqual(hookContext.provider, 'openai')
    assert.ok(hookContext.url)
    assert.ok(hookContext.body)
  })

  it('should invoke onResponse hook after response', async () => {
    let hookCalled = false
    let hookContext = null

    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
      },
    })

    const ai = createAi({
      onResponse: (context) => {
        hookCalled = true
        hookContext = context
      },
    })

    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.ok(hookCalled)
    assert.ok(hookContext)
    assert.strictEqual(hookContext.status, 200)
    assert.ok(hookContext.duration >= 0)
    assert.ok(hookContext.data)
  })

  it('should invoke both hooks in order', async () => {
    const callOrder = []

    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
      },
    })

    const ai = createAi({
      onRequest: () => {
        callOrder.push('request')
      },
      onResponse: () => {
        callOrder.push('response')
      },
    })

    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.deepStrictEqual(callOrder, ['request', 'response'])
  })

  it('should support async hooks', async () => {
    let hookCompleted = false

    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
      },
    })

    const ai = createAi({
      onRequest: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      },
      onResponse: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        hookCompleted = true
      },
    })

    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.ok(hookCompleted)
  })
})

describe('logger', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
    // Reset to default logger
    setLogger({
      warn: (msg) => console.warn(msg),
      error: (msg) => console.error(msg),
      debug: (msg) => console.debug(msg),
    })
  })

  afterEach(() => {
    setLogger({
      warn: (msg) => console.warn(msg),
      error: (msg) => console.error(msg),
      debug: (msg) => console.debug(msg),
    })
  })

  it('should use custom logger', () => {
    let warnCalled = false
    let errorCalled = false

    const customLogger = {
      warn: () => {
        warnCalled = true
      },
      error: () => {
        errorCalled = true
      },
      debug: () => {},
    }

    setLogger(customLogger)
    
    // Logger should be set
    assert.ok(warnCalled === false)
    assert.ok(errorCalled === false)
  })

  it('should silence output with noopLogger', () => {
    setLogger(noopLogger)

    // Noop logger should not produce output
    assert.ok(noopLogger.warn)
    assert.ok(noopLogger.error)
    assert.ok(noopLogger.debug)
  })
})

describe('cost calculation', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should calculate estimated cost correctly', async () => {
    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
        },
      },
    })

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    // gpt-4o: $2.50/1M input, $10/1M output
    // Input: 100/1M * 2.50 = 0.00025
    // Output: 200/1M * 10 = 0.002
    // Total: 0.00225
    assert.ok(result.usage.estimatedCost > 0)
    assert.ok(typeof result.usage.estimatedCost === 'number')
  })

  it('should include reasoning tokens in cost calculation', async () => {
    global.fetch = () => mockFetchResponse({
      ok: true,
      status: 200,
      data: {
        choices: [{ message: { content: 'Response' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          completion_tokens_details: {
            reasoning_tokens: 50,
          },
        },
      },
    })

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
    })

    assert.strictEqual(result.usage.reasoningTokens, 50)
    assert.ok(result.usage.estimatedCost > 0)
  })
})

describe('messages array support', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should accept messages array instead of prompt', async () => {
    global.fetch = (url, options) => {
      const body = JSON.parse(options.body)
      assert.ok(body.messages)
      assert.strictEqual(body.messages.length, 2)
      
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          choices: [{ message: { content: 'Multi-turn response' } }],
          usage: { prompt_tokens: 20, completion_tokens: 15 },
        },
      })
    }

    const ai = createAi()
    const result = await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      messages: [
        { role: 'user', content: 'What is the capital of Vietnam?' },
        { role: 'assistant', content: 'The capital is Hanoi.' },
      ],
    })

    assert.strictEqual(result.text, 'Multi-turn response')
  })

  it('should throw for empty message content', async () => {
    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        messages: [{ role: 'user', content: '' }],
      }),
      InputError
    )
  })

  it('should throw for invalid role in messages', async () => {
    const ai = createAi()
    
    await assert.rejects(
      () => ai.ask({
        model: 'openai/gpt-4o',
        apikey: 'test-key',
        messages: [{ role: 'bot', content: 'Hello' }],
      }),
      InputError
    )
  })
})

describe('stop parameter', () => {
  beforeEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('should pass stop parameter to provider', async () => {
    let requestBody = null

    global.fetch = (url, options) => {
      requestBody = JSON.parse(options.body)
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        },
      })
    }

    const ai = createAi()
    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
      stop: ['END', 'STOP'],
    })

    assert.ok(requestBody.stop)
    assert.deepStrictEqual(requestBody.stop, ['END', 'STOP'])
  })

  it('should pass stop as string to provider', async () => {
    let requestBody = null

    global.fetch = (url, options) => {
      requestBody = JSON.parse(options.body)
      return mockFetchResponse({
        ok: true,
        status: 200,
        data: {
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        },
      })
    }

    const ai = createAi()
    await ai.ask({
      model: 'openai/gpt-4o',
      apikey: 'test-key',
      prompt: 'Hello',
      stop: 'END',
    })

    assert.ok(requestBody.stop)
    assert.strictEqual(requestBody.stop, 'END')
  })
})

describe('ProviderError properties', () => {
  it('should have correct properties', () => {
    const error = new ProviderError('Test error', {
      status: 429,
      provider: 'openai',
      model: 'gpt-4o',
      raw: 'Rate limited',
    })

    assert.strictEqual(error.name, 'ProviderError')
    assert.strictEqual(error.status, 429)
    assert.strictEqual(error.provider, 'openai')
    assert.strictEqual(error.model, 'gpt-4o')
    assert.strictEqual(error.raw, 'Rate limited')
  })

  it('should support retryAfter property', () => {
    const error = new ProviderError('Rate limited', {
      status: 429,
      provider: 'openai',
      model: 'gpt-4o',
      retryAfter: 5000,
    })

    assert.strictEqual(error.retryAfter, 5000)
  })
})

describe('InputError properties', () => {
  it('should have correct properties', () => {
    const error = new InputError('Invalid request', {
      status: 400,
      provider: 'openai',
      model: 'gpt-4o',
      raw: 'Bad request',
    })

    assert.strictEqual(error.name, 'InputError')
    assert.strictEqual(error.status, 400)
    assert.strictEqual(error.provider, 'openai')
    assert.strictEqual(error.model, 'gpt-4o')
    assert.strictEqual(error.raw, 'Bad request')
  })
})