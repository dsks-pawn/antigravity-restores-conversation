# Change Log

All notable changes to the "antigravity-restores-conversation" extension will be documented in this file.

## [1.0.0] - Initial Release

- Migrated core engine from Python to Node.js/TypeScript.
- Implement robust binary Protobuf (`.pb`) parsing.
- Implement standalone Node.js SQLite integration (`better-sqlite3`) outside the Extension Host to avoid ABI mismatch.
- Introduce beautiful Extension GUI (Webview with Tailwind & Glassmorphism).
- Introduce Terminal UI (`@clack/prompts`).
- Automated IDE shutdown mechanism to resolve SQLite file-locking issues.
