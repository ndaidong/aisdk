/**
 * @fileoverview Configurable logger for @pwshub/aisdk
 *
 * Provides a default console logger with the ability to set custom
 * or no-op loggers for production environments.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} warn
 * @property {(message: string) => void} error
 * @property {(message: string) => void} debug
 */

const defaultLogger = {
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
  debug: (message) => console.debug(message),
}

let currentLogger = defaultLogger

/**
 * Sets a custom logger instance
 * @param {Logger} logger
 * @throws {Error} When logger doesn't implement required methods
 */
export const setLogger = (logger) => {
  if (!logger || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
    throw new Error('Logger must implement warn() and error() methods')
  }
  currentLogger = logger
}

/**
 * Returns the current logger instance
 * @returns {Logger}
 */
export const getLogger = () => currentLogger

/**
 * No-op logger for silencing all output
 */
export const noopLogger = {
  warn: () => {},
  error: () => {},
  debug: () => {},
}