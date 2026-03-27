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
 * @typedef {'openai'|'anthropic'|'google'|'dashscope'|'deepseek'|'mistral'|'ollama'} ProviderId
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
 * @property {number} cacheTokens     - 0 when not applicable
 * @property {number} reasoningTokens - 0 when not applicable
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {(apikey: string) => Record<string, string>} headers
 * @property {(modelName: string, apikey: string) => string} url
 * @property {(modelName: string, messages: Message[], config: Record<string, unknown>, providerOptions: Record<string, unknown>) => Record<string, unknown>} buildBody
 * @property {(data: Record<string, unknown>) => string} extractText
 * @property {(data: Record<string, unknown>) => RawUsage} extractUsage
 */

/** @type {ProviderAdapter} */
const openai = {
  headers: (apikey) => ({
    Authorization: `Bearer ${apikey}`,
    'Content-Type': 'application/json',
  }),
  url: (modelName, apikey, gatewayUrl) => gatewayUrl || 'https://api.openai.com/v1/chat/completions',
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
    reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  }),
}

/** @type {ProviderAdapter} */
const anthropic = {
  headers: (apikey) => ({
    'x-api-key': apikey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  }),
  url: (modelName, apikey, gatewayUrl) => gatewayUrl || 'https://api.anthropic.com/v1/messages',
  buildBody: (modelName, messages, config, providerOptions) => {
    const system = messages.find((m) => m.role === 'system')?.content
    const filtered = messages.filter((m) => m.role !== 'system')
    return {
      model: modelName,
      messages: filtered,
      ...(system && { system }),
      max_tokens: 4096, // required — overridden if maxTokens was in config
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
    cacheTokens: (data.usage?.cache_read_input_tokens ?? 0) + (data.usage?.cache_creation_input_tokens ?? 0),
    reasoningTokens: 0,
  }),
}

/** @type {ProviderAdapter} */
const google = {
  headers: () => ({ 'Content-Type': 'application/json' }),
  url: (modelName, apikey, gatewayUrl) => {
    if (gatewayUrl) {
      return gatewayUrl
    }
    return `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apikey}`
  },
  buildBody: (modelName, messages, config, providerOptions) => {
    const system = messages.find((m) => m.role === 'system')?.content
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    
    // Thinking models (e.g., gemini-2.5-pro) need more tokens for reasoning
    // Set a higher default maxOutputTokens if not specified
    const hasMaxTokens = config.generationConfig?.maxOutputTokens !== undefined
    const defaultGenerationConfig = hasMaxTokens ? {} : { maxOutputTokens: 8192 }
    
    return {
      contents,
      ...(system && { systemInstruction: { parts: [{ text: system }] } }),
      generationConfig: {
        ...defaultGenerationConfig,
        ...config.generationConfig,
      },
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

    // Handle different content structures
    const content = candidate.content
    if (!content) {
      throw new Error('Google response missing content')
    }

    // Gemini 2.5 Pro (thinking model) may return content without parts
    // when all tokens were used for reasoning
    if (!content.parts || (Array.isArray(content.parts) && content.parts.length === 0)) {
      const thoughts = data.usageMetadata?.thoughtsTokenCount ?? 0
      const totalTokens = data.usageMetadata?.totalTokenCount ?? 0
      
      if (finishReason === 'MAX_TOKENS' && thoughts > 0) {
        throw new Error(
          `Google model used ${thoughts}/${totalTokens} tokens for internal reasoning and has no tokens left for output. ` +
          `Increase maxTokens to allow room for both thinking and response.`
        )
      }
      
      throw new Error('Google response has no content parts')
    }

    // Gemini may return parts as array or direct text
    if (Array.isArray(content.parts)) {
      // Concatenate all text parts (model may return multiple text blocks)
      const texts = content.parts.filter((p) => p.text).map((p) => p.text)
      if (texts.length === 0) {
        const thoughts = data.usageMetadata?.thoughtsTokenCount ?? 0
        if (finishReason === 'MAX_TOKENS' && thoughts > 0) {
          throw new Error(
            `Google model used ${thoughts}/${data.usageMetadata?.totalTokenCount ?? 0} tokens for internal reasoning and has no tokens left for output. ` +
            `Increase maxTokens to allow room for both thinking and response.`
          )
        }
        throw new Error('Google response has no text content')
      }
      return texts.join('')
    }

    // Some models may return content directly as string
    if (typeof content.parts === 'string') {
      return content.parts
    }

    throw new Error('Google response missing content')
  },
  extractUsage: (data) => {
    // For Gemini models with reasoning, candidatesTokenCount may be undefined
    // when all tokens were used for thinking. Calculate output tokens from
    // totalTokenCount - promptTokenCount to get actual tokens used.
    const totalTokens = data.usageMetadata?.totalTokenCount ?? 0
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0
    const candidatesTokens = data.usageMetadata?.candidatesTokenCount ?? 0
    const thoughtsTokens = data.usageMetadata?.thoughtsTokenCount ?? 0
    
    // outputTokens = actual generated tokens (including reasoning)
    // If candidatesTokenCount is missing, derive from total - prompt
    const outputTokens = candidatesTokens || (totalTokens - promptTokens)
    
    return {
      inputTokens: promptTokens,
      outputTokens,
      cacheTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
      reasoningTokens: thoughtsTokens,
    }
  },
}

/** @type {ProviderAdapter} */
const dashscope = {
  headers: (apikey) => ({
    Authorization: `Bearer ${apikey}`,
    'Content-Type': 'application/json',
  }),
  // International users should use dashscope-intl.aliyuncs.com
  // China users can use dashscope.aliyuncs.com
  url: (modelName, apikey, gatewayUrl) => gatewayUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      reasoningTokens: 0,
    }
  },
}

/** @type {ProviderAdapter} */
const deepseek = {
  headers: (apikey) => ({
    Authorization: `Bearer ${apikey}`,
    'Content-Type': 'application/json',
  }),
  url: (modelName, apikey, gatewayUrl) => gatewayUrl || 'https://api.deepseek.com/chat/completions',
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
    cacheTokens: data.usage?.prompt_cache_hit_tokens ?? 0,
    reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  }),
}

/** @type {ProviderAdapter} */
const mistral = {
  headers: (apikey) => ({
    Authorization: `Bearer ${apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }),
  url: (modelName, apikey, gatewayUrl) => gatewayUrl || 'https://api.mistral.ai/v1/chat/completions',
  buildBody: (modelName, messages, config, providerOptions) => ({
    model: modelName,
    messages,
    ...config,
    ...providerOptions,
  }),
  extractText: (data) => {
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('Mistral response missing content')
    }
    return content
  },
  extractUsage: (data) => ({
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cacheTokens: 0,
    reasoningTokens: 0,
  }),
}

/** @type {ProviderAdapter} */
const ollama = {
  headers: (apikey) => ({
    'Content-Type': 'application/json',
    ...(apikey && { Authorization: `Bearer ${apikey}` }),
  }),
  url: (modelName, apikey, gatewayUrl) => {
    if (gatewayUrl) {
      return gatewayUrl
    }
    // Warn about localhost default in development
    console.warn('[ai-client] Ollama using default localhost URL (http://localhost:11434). Set gatewayUrl in createAi() for production.')
    return 'http://localhost:11434/api/chat'
  },
  buildBody: (modelName, messages, config, providerOptions) => {
    // Ollama uses snake_case options
    const options = {}
    if (config.temperature !== undefined) options.temperature = config.temperature
    if (config.top_p !== undefined) options.top_p = config.top_p
    if (config.top_k !== undefined) options.top_k = config.top_k
    if (config.num_predict !== undefined) options.num_predict = config.num_predict
    if (config.seed !== undefined) options.seed = config.seed
    if (config.stop !== undefined) options.stop = config.stop
    
    return {
      model: modelName,
      messages,
      stream: false,
      ...providerOptions,
      ...(Object.keys(options).length > 0 && { options }),
    }
  },
  extractText: (data) => {
    const content = data.message?.content
    if (!content) {
      throw new Error('Ollama response missing content')
    }
    return content
  },
  extractUsage: (data) => ({
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    cacheTokens: 0,
    reasoningTokens: 0,
  }),
}

/** @type {Record<string, ProviderAdapter>} */
const ADAPTERS = {
  openai, anthropic, google, dashscope, deepseek, mistral, ollama,
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
