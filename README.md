# @ndaidong/aisdk

A thin, unified AI client for OpenAI, Anthropic, Google, DashScope, and DeepSeek with automatic param normalization and fallback support.

## Features

- **Unified API** — Single `ask()` method for all providers
- **Automatic param normalization** — Canonical camelCase params translated to provider wire format
- **Flexible value coercion** — Out-of-range values are clamped (not thrown) with warnings
- **Fallback support** — Chain of fallback models for high availability
- **Cost estimation** — Automatic USD cost calculation based on token usage
- **Type-safe** — JSDoc types throughout

## Installation

```bash
npm install @ndaidong/aisdk
```

## Quick Start

```javascript
import { createAi } from '@ndaidong/aisdk'

const ai = createAi()

const result = await ai.ask({
  model: 'claude-sonnet-4-20250514',
  prompt: 'What is the capital of Vietnam?',
  temperature: 0.5,
})

console.log(result.text)
console.log(result.usage)
// { inputTokens: 21, outputTokens: 11, cacheTokens: 0, estimatedCost: 0.00022800 }
```

## Environment Variables

Set API keys for providers you use:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
export DASHSCOPE_API_KEY=...
export DEEPSEEK_API_KEY=...
```

## API

### `createAi(options?)`

```javascript
const ai = createAi({
  gatewayUrl: 'https://your-gateway.example.com' // optional override
})
```

### `ai.ask(params)`

| Param | Type | Description |
|-------|------|-------------|
| `model` | `string` | Model ID (required) |
| `prompt` | `string` | User message (required) |
| `system` | `string` | Optional system prompt |
| `temperature` | `number` | Clamped to provider range |
| `maxTokens` | `number` | Max output tokens |
| `topP` | `number` | Nucleus sampling |
| `topK` | `number` | Top-K sampling |
| `frequencyPenalty` | `number` | OpenAI/DeepSeek only |
| `presencePenalty` | `number` | OpenAI/DeepSeek only |
| `fallbacks` | `string[]` | Fallback model chain |
| `providerOptions` | `object` | Provider-specific options |

### Param Coercion

Values outside provider ranges are **clamped**, not thrown:

```javascript
// OpenAI temperature range is [0, 2]
await ai.ask({
  model: 'gpt-4o',
  prompt: 'Hello',
  temperature: 5, // clamped to 2 with warning
})
```

### Fallbacks

```javascript
const result = await ai.ask({
  model: 'gpt-4o',
  prompt: 'Summarize the history of Hoi An.',
  fallbacks: ['gpt-4o-mini', 'claude-haiku-4-5-20251001'],
})

if (result.model !== 'gpt-4o') {
  console.warn('Primary model unavailable, used:', result.model)
}
```

### Google Provider Options

```javascript
const result = await ai.ask({
  model: 'gemini-2.5-pro-preview-03-25',
  prompt: 'Explain quantum entanglement.',
  providerOptions: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
    thinkingConfig: {
      thinkingBudget: 2048,
    },
  },
})
```

## Supported Models

```javascript
const models = ai.listModels()
console.table(models)
```

## Error Handling

```javascript
import { createAi, ProviderError, InputError } from '@ndaidong/aisdk'

const ai = createAi()

try {
  const result = await ai.ask({ model: 'gpt-4o', prompt: '...' })
} catch (err) {
  if (err instanceof ProviderError) {
    // 429 or 5xx — safe to retry or fallback
    console.log('Provider error, retry:', err.status)
  } else if (err instanceof InputError) {
    // 400, 401, 403, 422 — fix input, do not retry
    console.log('Bad input:', err.message)
  }
}
```

## License

MIT
