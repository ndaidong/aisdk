#!/usr/bin/env node
/**
 * @fileoverview Google provider evaluation script.
 *
 * Usage:
 *   GOOGLE_API_KEY=your-key node examples/google.js
 */

import { createAi } from '../src/index.js'
import { runEvalSuite } from './utils.js'

const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

const PROMPTS = [
  'What is the capital of Vietnam?',
  'Explain quantum entanglement in one paragraph.',
  'Write a haiku about TypeScript.',
]

const main = async () => {
  const apikey = process.env.GOOGLE_API_KEY
  if (!apikey) {
    throw new Error('Missing env var: GOOGLE_API_KEY')
  }

  console.log('Running Google provider evaluation...\n')

  const ai = createAi()

  // Note: temperature is not specified to let each model use its default
  // gemini-2.5-pro needs higher maxTokens because it uses many tokens for reasoning
  await runEvalSuite(ai.ask, MODELS, PROMPTS, apikey, { maxTokens: 2048 })
}

main().catch(console.error)
