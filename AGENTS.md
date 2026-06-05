# Repository Guidelines

## Project Overview

Cow Visioning is a cow behavior dataset management system. Upload, camera capture, gallery browsing, AI-powered behavior detection (YOLO / Tool Pro), and Telegram QA bot. Runs on Node.js + PostgreSQL + Python AI service, tunneled via Cloudflare.

## Project Structure

```
server.js              # Express app, routes, auth, uploads, Telegram webhook
telegram-notifier.js   # Telegram message formatting and sending
telegram-command-router.js  # Bot command handlers (/whoami, /listcow, etc.)
telegram-user-linking.js    # DB-backed Telegram-to-web account linking
schema.sql             # Main PostgreSQL schema
migrations/            # Incremental DB migrations (001, 002)
ai_service/            # Python FastAPI AI service (YOLO predictor)
public/                # Frontend: HTML, CSS, JS
  js/                  # Client modules (app.js, camera-*.js, settings.js, etc.)
  css/                 # Stylesheets (style.css, auth.css, etc.)
tests/                 # Jest test suites
docs/                  # Project documentation (QA topics, commands, etc.)
plans/                 # Planning docs and reports
uploads/               # Uploaded cow images (gitignored)
```

## Build & Development Commands

| Command | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run start:ai` | Start Python AI service (port 8001) |
| `node -c <file.js>` | Syntax check without running |
| `npx jest tests/<file>.test.js` | Run specific test file |

## Coding Style

- **JS**: CommonJS (require/module.exports), kebab-case file names.
- **Indentation**: 4 spaces.
- **Strings**: Single quotes for JS, template literals for interpolation.
- **Emoji in Telegram messages**: Use ASCII labels like [TAG], not raw emoji (encoding safety on Windows).
- **Naming**: camelCase for JS functions/variables.
- **Modularization**: Keep files under 200 lines. Split large modules.
- **Error handling**: Always wrap async calls in try/catch or .catch().

## Testing

- **Framework**: Jest (node environment).
- **Test files**: Located in tests/, named *.test.js.
- **Run all**: `npm test`
- **Run specific**: `npx jest tests/telegram-notifier.test.js --runInBand`
- **Force exit**: Always pass --forceExit for tests with async network calls.
- **Pattern**: describe('module-name', () => { it('does X', () => { /* ... */ }) })

## Commit Guidelines

- Use conventional commits: feat:, fix:, refactor:, docs:, test:.
- Keep commits focused on one change.
- Never commit .env, API keys, tokens, or DB credentials.
- Run npm test before push.

## Pull Request Guidelines

- Describe what changed and why.
- Link related issues if applicable.
- Include screenshots for UI changes.
- Ensure all tests pass.
- Do not bundle unrelated changes.

## Security Notes

- .env contains secrets (bot token, DB password). Never expose.
- Telegram admin actions require linked web account with role=admin.
- Rate limiting enabled on auth routes.
- Session cookies are httpOnly and secure in production.

## Architecture

- **Backend**: Express.js on port 2609 (configurable via .env).
- **Database**: PostgreSQL (cow_visioning), schema in schema.sql.
- **AI**: Python FastAPI service on port 8001 (YOLO/Tool Pro).
- **Telegram**: Webhook at POST /api/telegram/webhook, 6 group topics for QA.
- **Tunnel**: Cloudflare Tunnel exposes local server to pctsv.io.vn.
- **Auth**: bcrypt passwords, express-session with PostgreSQL store.
