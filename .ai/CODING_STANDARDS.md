# Coding Standards

All JavaScript code generated must follow these rules strictly.

## General Rules
- No semicolons
- Single quotes for strings
- 2 spaces for indentation
- camelCase for variables and functions
- Always use ESM syntax (import/export)
- Arrow functions preferred, max 3 parameters
- Functional programming paradigm (pure functions, immutability)

## Documentation
- Add JSDocs comments before functions and important variables
- Comments must be in American English
- Never use Vietnamese or Chinese in source code

## Frontend Specifics
- Use native CSS
- Postcss when needed
- Never Tailwind CSS

## Backend Specifics
- Use async/await for database operations
- Handle errors explicitly, do not swallow exceptions

## Testing
- Write tests for critical business logic
- Use simple test runners (node:test, bun:test, vitest)
- No complex mocking frameworks unless necessary

## ESLint Configuration

### Philosophy
- ESLint is a safety net, not the primary source of truth
- .rules file is the primary source for coding standards
- ESLint focuses on critical errors, not stylistic issues

### Critical Rules (Must Pass)
- no-undef, no-unused-vars, no-const-assign
- no-eval, no-debugger (security)
- eqeqeq, no-throw-literal (best practices)

### Stylistic Rules (Handled by AI)
- semi, quotes, indent, camelcase
- These are enforced via .rules, not ESLint

### Pre-commit
- Run ESLint before commit
- Critical errors block commit
- Warnings are acceptable for stylistic issues
