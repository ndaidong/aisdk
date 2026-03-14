# Security Policy

## Critical Rules
1. NEVER output or request `.env` and `example.env` file contents
2. NEVER hardcode API credentials, secret tokens, private keys or passwords in source code
3. NEVER send sensitive user data to external AI services
4. Follow `.aiignore` and `.gitignore` for excluded files

## Data Privacy
- When asking for help, sanitize data (replace real IDs, emails, tokens with placeholders)
- Do not log sensitive information
