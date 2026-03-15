# @pwshub/aisdk

A thin, unified AI client for OpenAI, Anthropic, Google, DashScope, and DeepSeek with automatic parameter normalization and fallback support.

## Features

- **Unified API**: Single interface for multiple AI providers
- **Automatic parameter normalization**: Canonical camelCase params are translated to provider-specific wire format
- **Parameter clamping**: Values are automatically clamped to provider-accepted ranges
- **Fallback support**: Chain multiple models with automatic fallback on provider errors
- **Token usage tracking**: Detailed token counts and estimated cost per request
- **Provider-specific options**: Pass provider-specific parameters when needed

## Limitations

This package is designed for **personal project usage** with a focus on simplicity:

- **Text-only chat**: Supports basic text generation and conversation
- **No streaming**: All responses are returned as complete results
- **No multimodal inputs**: Images, audio, video, and file uploads are not supported
- **No function calling**: Tool use and function calling features are not available

For production applications requiring advanced features, consider using the official provider SDKs directly.

## Installation

```bash
npm i @pwshub/aisdk
# or
pnpm i @pwshub/aisdk
# or
bun add @pwshub/aisdk
```

## Quick Start

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi()

// Basic usage
const result = await ai.ask({
  model: 'gpt-4o',
  apikey: 'your-api-key-here',
  prompt: 'What is the capital of Vietnam?',
  temperature: 0.5,
})

console.log(result.text)
console.log(result.usage) // { inputTokens, outputTokens, cacheTokens, estimatedCost }
```

## API

### `createAi(options?)`

Creates an AI client instance.

**Options:**
- `gatewayUrl` (optional): Override the default API endpoint URL

**Returns:** An object with:
- `ask(params)`: Send a generation request
- `listModels()`: Get all available models from the registry

### `ai.ask(params)`

Sends a text generation request.

**Parameters:**
- `model` (string, required): Model ID (must exist in models.json)
- `apikey` (string, required): API key for the provider
- `prompt` (string, required): The user message
- `system` (string, optional): Optional system prompt
- `fallbacks` (string[], optional): Ordered list of fallback model IDs
- `providerOptions` (object, optional): Provider-specific options
- `temperature` (number, optional): Sampling temperature
- `maxTokens` (number, optional): Maximum output tokens
- `topP` (number, optional): Nucleus sampling parameter
- `topK` (number, optional): Top-K sampling
- `frequencyPenalty` (number, optional): Frequency penalty
- `presencePenalty` (number, optional): Presence penalty

**Returns:** Promise resolving to:
```javascript
{
  text: string,           // Generated text
  model: string,          // Model that responded
  usage: {
    inputTokens: number,
    outputTokens: number,
    cacheTokens: number,
    reasoningTokens: number,  // Reasoning/thinking tokens (0 for non-reasoning models)
    estimatedCost: number     // USD
  }
}
```

**Throws:**
- `ProviderError`: Transient provider errors (429, 5xx) — safe to retry
- `InputError`: Invalid input (400, 401, 403, 422) — fix input, do not retry

## Examples

### OpenAI

```javascript
import { createAi } from '@pwshub/aisdk'

const ai = createAi()

const result = await ai.ask({
  model: 'gpt-4o',
  apikey: process.env.OPENAI_API_KEY,
  prompt: 'Explain quantum entanglement',
  temperature: 0.7,
  maxTokens: 500,
})
```

### Anthropic

```javascript
const result = await ai.ask({
  model: 'claude-sonnet-4-6',
  apikey: process.env.ANTHROPIC_API_KEY,
  prompt: 'Write a haiku about TypeScript',
  temperature: 0.5,
})
```

### Google

```javascript
const result = await ai.ask({
  model: 'gemini-2.5-flash',
  apikey: process.env.GOOGLE_API_KEY,
  prompt: 'What is 2+2?',
  providerOptions: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    ],
  },
})
```

### Google (Disable Thinking Mode)

Gemini 2.5 Pro and other reasoning models use thinking tokens by default. Disable thinking mode to reduce latency and cost:

```javascript
const result = await ai.ask({
  model: 'gemini-2.5-pro',
  apikey: process.env.GOOGLE_API_KEY,
  prompt: 'What is the capital of Vietnam?',
  maxTokens: 256,
  providerOptions: {
    thinkingConfig: {
      thinkingBudget: 0,      // Disable reasoning tokens
      includeThoughts: false, // Don't include thought process in response
    },
  },
})
```

> **Note:** When thinking mode is enabled (default for Gemini 2.5 Pro), the model may use most of the `maxTokens` budget for reasoning. Set a higher `maxTokens` (e.g., 2048) or disable thinking with `thinkingBudget: 0`.

### With Fallbacks

```javascript
try {
  const result = await ai.ask({
    model: 'gpt-4o',
    apikey: process.env.OPENAI_API_KEY,
    prompt: 'Hello',
    fallbacks: ['gpt-4o-mini', 'claude-haiku-4-5'],
  })
  
  if (result.model !== 'gpt-4o') {
    console.warn(`Fell back to ${result.model}`)
  }
} catch (error) {
  if (error instanceof ProviderError) {
    console.error('All models failed:', error.message)
  } else if (error instanceof InputError) {
    console.error('Invalid request:', error.message)
  }
}
```

### DashScope (Alibaba)

```javascript
const result = await ai.ask({
  model: 'qwen3.5-plus',
  apikey: process.env.DASHSCOPE_API_KEY,
  prompt: 'Hello',
})
```

### DashScope with Custom Region

DashScope endpoints vary by region. Use `gatewayUrl` to specify your region:

```javascript
import { createAi } from '@pwshub/aisdk'

// Singapore region
const aiSingapore = createAi({
  gatewayUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
})

// Virginia region (US)
const aiUS = createAi({
  gatewayUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
})

// Beijing region (China)
const aiCN = createAi({
  gatewayUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

// Use the regional client
const result = await aiSingapore.ask({
  model: 'qwen3.5-plus',
  apikey: process.env.DASHSCOPE_API_KEY,
  prompt: 'Hello from Singapore!',
})
```

### DeepSeek

```javascript
const result = await ai.ask({
  model: 'deepseek-chat',
  apikey: process.env.DEEPSEEK_API_KEY,
  prompt: 'Hello',
})
```

## Supported Models

This library does not ship with a predefined list of models. Instead, it accepts **any model** from the supported providers:

- **OpenAI**: Any OpenAI model
- **Anthropic**: Any Anthropic model
- **Google**: Any Google model
- **DashScope**: Any DashScope model
- **DeepSeek**: Any DeepSeek model

### Loading Models

Models are loaded programmatically via `setModels()` from external sources (CMS, API, or local files for evaluation):

```javascript
import { createAi, setModels } from '@pwshub/aisdk'

// Load models from your CMS or API
const modelsFromCms = await fetch('https://cms.example.com/api/models').then(r => r.json())
setModels(modelsFromCms)

const ai = createAi()
const result = await ai.ask({
  model: 'gemini-2.5-flash',
  apikey: 'your-api-key',
  prompt: 'Hello!',
})
```

### Model Record Format

Each model record should include:
- `id`: Model identifier used in requests
- `name`: Official model name (used in API calls)
- `provider`: Provider ID (openai, anthropic, google, dashscope, deepseek)
- `input_price`: Price per 1M input tokens (USD)
- `output_price`: Price per 1M output tokens (USD)
- `cache_price`: Price per 1M cached tokens (USD)
- `max_in`: Maximum input tokens (context window)
- `max_out`: Maximum output tokens
- `enable`: Boolean to enable/disable the model
- `supportedParams` (optional): Array of supported parameter names

> **Note**: The `examples/` folder includes `models.json` as a reference for running evaluation scripts.

## Error Handling

```javascript
import { createAi, ProviderError, InputError } from '@pwshub/aisdk'

const ai = createAi()

try {
  const result = await ai.ask({
    model: 'gpt-4o',
    apikey: process.env.OPENAI_API_KEY,
    prompt: 'Hello',
  })
} catch (error) {
  if (error instanceof ProviderError) {
    // Provider-side error (rate limit, server error)
    // Safe to retry or fallback to another model
    console.error('Provider error:', error.status, error.message)
  } else if (error instanceof InputError) {
    // Client-side error (bad request, invalid API key)
    // Do NOT retry — fix the input
    console.error('Input error:', error.status, error.message)
  }
}
```

## Running Evaluation Scripts

The package includes evaluation scripts to test each provider:

```bash
# OpenAI
OPENAI_API_KEY=your-key npm run eval:openai

# Anthropic
ANTHROPIC_API_KEY=your-key npm run eval:anthropic

# Google
GOOGLE_API_KEY=your-key npm run eval:google

# DashScope
DASHSCOPE_API_KEY=your-key npm run eval:dashscope

# DeepSeek
DEEPSEEK_API_KEY=your-key npm run eval:deepseek
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## AI Agents team

- Claude Code: initiator
- Qwen Code: implementer
- Google Gemini: reviewer
- DeepSeek: supporter
- Ollama: supporter

## License

MIT
