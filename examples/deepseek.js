#!/usr/bin/env node
/**
 * @fileoverview DeepSeek provider evaluation script.
 *
 * Usage:
 *   DEEPSEEK_API_KEY=your-key node examples/deepseek.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  console.log('Running DeepSeek provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, {
    maxTokens: 256,
  })
}

main().catch(console.error)
