#!/usr/bin/env node
/**
 * @fileoverview DashScope (Alibaba) provider evaluation script.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=your-key node examples/dashscope.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'qwen3.5-plus',
  'qwen-max',
  'qwen3-max',
  'qwen-plus',
  'qwen3.5-flash',
  'qwen-flash',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  console.log('Running DashScope provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, {
    maxTokens: 256,
  })
}

main().catch(console.error)
