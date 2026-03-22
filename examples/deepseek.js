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
  'deepseek/deepseek-chat',
  'deepseek/deepseek-reasoner',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  const apikey = process.env.DEEPSEEK_API_KEY
  if (!apikey) {
    throw new Error('Missing env var: DEEPSEEK_API_KEY')
  }

  console.log('Running DeepSeek provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 256 })
}

main().catch(console.error)
