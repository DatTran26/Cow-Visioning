# Telegram Bot Commands

## Overview

Cow Visioning bot supports notifications, QA buttons, and slash commands in private chat or Telegram forum group topics.

## Environment

Add these values to `.env`:

```env
TELEGRAM_COMMANDS_ENABLED=true
TELEGRAM_BOT_USERNAME=cow_visioning_qa_bot
TELEGRAM_LINK_TOKEN_TTL_MINUTES=20
TELEGRAM_ADMIN_USER_IDS=6666230458
TELEGRAM_ALLOWED_USER_IDS=6666230458
TELEGRAM_MAX_COMMAND_RESULTS=5
```

Do not share `TELEGRAM_BOT_TOKEN`.

## Commands

### Permission Matrix

| Command | Private User | Private Web Admin | Group Admin | Purpose |
|---|---:|---:|---:|---|
| `/start` | yes | yes | yes | Open menu or link account with `link_<token>` |
| `/help` | yes | yes | yes | Show command help |
| `/whoami` | yes | yes | yes | Show Telegram/link/admin identity |
| `/me` | yes | yes | no | Show linked web account |
| `/myalerts` | yes | yes | no | Show private alert status |
| `/mute` | yes | yes | no | Disable private alerts |
| `/unmute` | yes | yes | no | Enable private alerts |
| `/unlink` | yes | yes | no | Disconnect Telegram account |
| `/myimages [limit]` | yes | yes | no | Show own latest images |
| `/mycow <cow_id> [limit]` | yes | yes | no | Show own cow history |
| `/myabnormal [limit]` | yes | yes | no | Show own abnormal images |
| `/status` | no | yes | yes | System status |
| `/latest [limit]` | no | yes | yes | Latest system images |
| `/listcow <behavior> [limit]` | no | yes | yes | System behavior filter |
| `/cow <cow_id> [limit]` | no | yes | yes | System cow history |
| `/abnormal [limit]` | no | yes | yes | System abnormal images |
| `/stats [today\|week\|month]` | no | yes | yes | System stats |
| `/qa [abnormal\|failed\|review] [limit]` | no | yes | yes | QA queue |
| `/mark <image_id> <behavior>` | no | yes | yes | Mutate image behavior |
| `/note <image_id> <text>` | no | yes | yes | Add QA note |

Rules:
- Private User = Telegram linked to any web account.
- Private Web Admin = Telegram linked to web account with `role=admin`.
- Group Admin = Telegram linked to web account with `role=admin`; `TELEGRAM_ADMIN_USER_IDS` is only fallback/bootstrap.
- Private user data commands must never show other users' rows.

```text
start - Open Cow Visioning QA menu
help - Show command help
status - Check server and database status
latest - Show latest cow images
listcow - Filter cows by behavior
cow - Show image history for one cow ID
qa - Open admin QA queue
mark - Admin: mark image behavior
note - Admin: add QA note to image
stats - Show upload and behavior stats
whoami - Show Telegram setup IDs
me - Show linked web account
myalerts - Show private alert status
mute - Mute private alerts
unmute - Enable private alerts
unlink - Disconnect Telegram
myimages - Show your own latest images
mycow - Show your own cow history
myabnormal - Show your own abnormal images
```

## Usage

```text
/whoami
/status
/latest 3
/listcow eating 3
/cow BO-001 3
/stats today
/qa abnormal 5
/mark 184 abnormal
/note 184 Cần kiểm tra lại ảnh này
/me
/myalerts
/mute
/unmute
/unlink
/myimages 3
/mycow BO-001 3
/myabnormal 3
```

Valid behaviors:

```text
standing, lying, eating, drinking, walking, abnormal
```

## BotFather Setup

1. Open `@BotFather`.
2. Run `/setcommands`.
3. Select `@cow_visioning_qa_bot`.
4. Paste the command list from this doc.
5. Repeat with BotFather scopes for private chats and group chats if needed.

## Group Command Suggestions

If commands appear in private chat but not group:

- Make bot admin in the group.
- In BotFather, set commands for all group chats.
- Try command with bot mention: `/status@cow_visioning_qa_bot`.
- If bot must read non-mentioned commands, use BotFather `/setprivacy` then `Disable`.

## Topic IDs

Use `/whoami` inside a topic to see:

- Telegram user ID
- group `chat_id`
- `message_thread_id`
- admin status

## Security

- `/qa`, `/mark`, `/note`, and QA callback buttons require `TELEGRAM_ADMIN_USER_IDS`.
- Read-only commands work for allowed users or the configured group.
- Private commands `/me`, `/myalerts`, `/mute`, `/unmute`, `/unlink`, `/myimages`, `/mycow`, `/myabnormal` work only in one-to-one bot chat after account linking.
- Bot responses never print tokens, DB passwords, or API keys.

## Rollback

Disable commands without disabling notifications:

```env
TELEGRAM_COMMANDS_ENABLED=false
```
