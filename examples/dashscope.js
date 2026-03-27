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
  'dashscope/qwen-plus',
  'dashscope/qwen-flash',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  const apikey = process.env.DASHSCOPE_API_KEY
  if (!apikey) {
    throw new Error('Missing env var: DASHSCOPE_API_KEY')
  }

  console.log('Running DashScope provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 256 })
}

main().catch(console.error)
