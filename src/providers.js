/**
 * @fileoverview Provider adapters — headers, URL, request body, response parsing.
 *
 * Each adapter also implements `extractUsage()` to pull token counts from the
 * raw response. Field names differ per provider; we normalize to canonical names.
 *
 * `providerOptions` is an escape hatch for provider-specific features that
 * cannot be generalized (e.g. Google's safetySettings, thinkingConfig).
 * Its contents are merged directly into the request body.
 */

/**
 * @typedef {'openai'|'anthropic'|'google'|'dashscope'|'deepseek'} ProviderId
 */

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} RawUsage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} cacheTokens   - 0 when not applicable
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {(apiKey: string) => Record<string, string>} headers
 * @property {(modelName: string, apiKey: string) => string} url
 * @property {(modelName: string, messages: Message[], config: Record<string, unknown>, providerOptions: Record<string, unknown>) => Record<string, unknown>} buildBody
 * @property {(data: Record<string, unknown>) => string} extractText
 * @property {(data: Record<string, unknown>) => RawUsage} extractUsage
 */

/** @type {ProviderAdapter} */
const openai = {
  headers: (apiKey) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }),
  url: () => 'https://api.openai.com/v1/chat/completions',
  buildBody: (modelName, messages, config, providerOptions) => ({
    model: modelName,
    messages,
    n: 1,
    ...config,
    ...providerOptions,
  }),
  extractText: (data) => {
    const choice = data.choices?.[0]
    if (!choice) {
      throw new Error(`OpenAI response missing choices. Full response: ${JSON.stringify(data)}`)
    }

    const message = choice.message
    if (!message) {
      throw new Error(`OpenAI response missing message. Full response: ${JSON.stringify(data)}`)
    }

    // Reasoning models (o1, o3, gpt-5) may return content differently
    // Try standard content first, then reasoning_content
    if (message.content) {
      return message.content
    }

    // Some reasoning models use reasoning_content
    if (message.reasoning_content) {
      return message.reasoning_content
    }

    // Fallback: check for any content-like field
    for (const key of Object.keys(message)) {
      if (key.includes('content') && typeof message[key] === 'string') {
        return message[key]
      }
    }

    throw new Error(`OpenAI response missing content. Message: ${JSON.stringify(message)}`)
  },
  extractUsage: (data) => ({
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cacheTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  }),
}

/** @type {ProviderAdapter} */
const anthropic = {
  headers: (apiKey) => ({
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  }),
  url: () => 'https://api.anthropic.com/v1/messages',
  buildBody: (modelName, messages, config, providerOptions) => {
    const system = messages.find((m) => m.role === 'system')?.content
    const filtered = messages.filter((m) => m.role !== 'system')
    return {
      model: modelName,
      messages: filtered,
      ...(system && { system }),
      max_tokens: 8096, // required — overridden if maxTokens was in config
      ...config,
      ...providerOptions,
    }
  },
  extractText: (data) => {
    // Anthropic can return multiple content blocks (text, tool_use, etc.)
    // Concatenate all text blocks
    const texts = data.content?.filter((c) => c.type === 'text').map((c) => c.text)
    if (!texts || texts.length === 0) {
      throw new Error('Anthropic response missing content')
    }
    return texts.join('')
  },
  extractUsage: (data) => ({
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cacheTokens: data.usage?.cache_read_input_tokens ?? 0,
  }),
}

/** @type {ProviderAdapter} */
const google = {
  headers: () => ({ 'Content-Type': 'application/json' }),
  url: (modelName, apiKey) =>
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
  buildBody: (modelName, messages, config, providerOptions) => {
    const system = messages.find((m) => m.role === 'system')?.content
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    return {
      contents,
      ...(system && { systemInstruction: { parts: [{ text: system }] } }),
      ...config, // includes nested generationConfig
      ...providerOptions, // safetySettings, thinkingConfig, etc.
    }
  },
  extractText: (data) => {
    // Google may return empty candidates if blocked by safety filters
    const candidate = data.candidates?.[0]
    if (!candidate) {
      throw new Error('Google response has no candidates (may be blocked by safety filters)')
    }

    const finishReason = candidate.finishReason
    if (finishReason === 'SAFETY') {
      throw new Error('Google response blocked by safety filters')
    }

    const text = candidate.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('Google response missing content')
    }
    return text
  },
  extractUsage: (data) => ({
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    cacheTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
  }),
}

/** @type {ProviderAdapter} */
const dashscope = {
  headers: (apiKey) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }),
  // International users should use dashscope-intl.aliyuncs.com
  // China users can use dashscope.aliyuncs.com
  url: () => 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  buildBody: (modelName, messages, config, providerOptions) => ({
    model: modelName,
    messages,
    ...config,
    ...providerOptions,
  }),
  extractText: (data) => {
    // OpenAI-compatible format returns choices directly
    const content = data.choices?.[0]?.message?.content ?? data.output?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('DashScope response missing content')
    }
    return content
  },
  extractUsage: (data) => {
    // OpenAI-compatible format
    const usage = data.usage ?? data.output?.usage
    return {
      inputTokens: usage?.input_tokens ?? usage?.prompt_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? usage?.completion_tokens ?? 0,
      cacheTokens: 0,
    }
  },
}

/** @type {ProviderAdapter} */
const deepseek = {
  headers: (apiKey) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }),
  url: () => 'https://api.deepseek.com/chat/completions',
  buildBody: (modelName, messages, config, providerOptions) => ({
    model: modelName,
    messages,
    ...config,
    ...providerOptions,
  }),
  extractText: (data) => {
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('DeepSeek response missing content')
    }
    return content
  },
  extractUsage: (data) => ({
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cacheTokens: 0,
  }),
}

/** @type {Record<string, ProviderAdapter>} */
const ADAPTERS = {
  openai, anthropic, google, dashscope, deepseek,
}

/**
 * Returns the provider adapter for a given provider ID.
 * @param {string} providerId
 * @returns {ProviderAdapter}
 * @throws {Error}
 */
export const getAdapter = (providerId) => {
  const adapter = ADAPTERS[providerId]
  if (!adapter) {
    throw new Error(`No adapter found for provider: "${providerId}"`)
  }
  return adapter
}
