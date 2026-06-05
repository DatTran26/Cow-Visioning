# Cow Visioning QA and Alert Requirements

## Purpose

This document is the business and QA source of truth for Cow Visioning alert behavior.

It defines:
- who receives alerts
- where alerts are sent
- what each alert must contain
- what must never be exposed
- how QA validates alert flows

## System Roles

| Role | Meaning | Permissions |
|---|---|---|
| Guest | Not logged in | No private alerts, no QA commands |
| User | Registered web account | Own images, own private Telegram alerts |
| Admin | Web role `admin` | System-wide web admin, group QA commands |
| QA/Operator | Trusted Telegram/admin user | Review queue, mark/note images |
| Bot/System | Cow Visioning Telegram bot | Sends group and private alerts |

## Telegram Channel Model

Detailed topic routing rules are documented in `docs/telegram-qa-topics.md`.

### Group Mode

Group mode is for admin/QA/system visibility only.

Current group: `Cow Visioning`.

Known topic usage:

| Topic | Purpose | Audience |
|---|---|---|
| Image Upload Alerts | Upload summary and image preview | Admin/QA |
| Cow Behavior | Behavior summaries | Admin/QA |
| AI Tool Pro Logs | AI success/failure/process logs | Admin/QA |
| User Activity | Login/register/link/QA action logs | Admin |
| System / Server Status | Health and operational status | Admin |
| Abnormal Detection | Urgent abnormal behavior alerts | Admin/QA |

Group commands are admin-only except public-safe identity/help commands.

### Private Mode

Private mode is for one linked web user.

Rules:
- User receives only alerts related to their own `user_id`.
- Telegram `telegram_user_id` is the identity key.
- Telegram username is display-only and not trusted for authorization.
- Bot can send private messages only after the user starts the bot.

## Account Linking Flow

```text
User logs in on pctsv.io.vn
  -> Account/Profile: Connect Telegram
  -> Server creates one-time token
  -> User opens https://t.me/<bot>?start=link_<token>
  -> Bot receives /start link_<token>
  -> Server validates token
  -> Server stores Telegram account mapping
  -> User receives private confirmation
```

## Alert Severity

| Severity | Meaning | Examples | Channels |
|---|---|---|---|
| Info | Normal event | Upload success, link success | Private, group summary |
| Warning | Needs attention | AI failed, unclear image | Private, AI logs |
| Critical | Requires quick review | Abnormal cow behavior | Private, Abnormal Detection, optional admin DM |
| System | Operational issue | DB/tunnel/server issue | System Status, optional admin DM |

## Event Matrix

| Event | Trigger | Private User Alert | Group Alert | Required Data |
|---|---|---|---|---|
| User registered | `POST /auth/register` success | No, unless already linked later | User Activity | username, time |
| Telegram linked | `/start link_<token>` success | Yes | User Activity | web username, Telegram ID, time |
| Telegram unlinked | web or `/unlink` | Confirmation before/after unlink if possible | User Activity | web username, time |
| Image uploaded | `POST /api/images` success | Yes to owner | Image Upload Alerts | image ID, cow ID, behavior, time |
| AI completed | AI result saved | Yes to owner | AI Tool Pro Logs if operational | provider, confidence, behavior |
| AI failed | AI processing fails | Yes to owner | AI Tool Pro Logs | image ID, failure status |
| Abnormal detected | behavior=`abnormal` | Yes urgent to owner | Abnormal Detection | cow ID, confidence, image ID |
| QA confirmed | admin callback/command | Yes to owner | User Activity | reviewer, image ID |
| QA marked abnormal | admin callback/command | Yes to owner | Abnormal Detection + User Activity | reviewer, image ID |
| QA note added | `/note` or web admin note | Yes summary to owner | User Activity | reviewer, note summary |
| System health issue | health check/manual command | No | System Status | status, time |
| System online | web server starts successfully | No | System / Server Status | service, URL, port, DB/tunnel summary, time |
| System offline | graceful shutdown or detected outage | No | System / Server Status | service, time, reason if known |
| System setting changed | admin changes AI/system/runtime settings | No | System / Server Status | actor, role, section, field, old value, new value, time |

## Message Content Rules

### Private User Messages

Allowed:
- image ID
- cow ID
- behavior
- confidence
- upload/AI status
- own image link
- admin QA note summary

Not allowed:
- other users’ usernames/emails
- DB host/password
- API keys
- Telegram bot token
- internal stack traces

### Group Messages

Allowed:
- operational summary
- image ID
- cow ID
- behavior
- uploader username if needed for admin QA
- public app link/image link

Not allowed:
- user email unless explicitly required later
- private link token
- session IDs
- API keys/secrets
- full internal exception traces

## Command Policy

### Group Commands

Admin-only:
- `/status`
- `/latest`
- `/listcow`
- `/cow`
- `/qa`
- `/mark`
- `/note`
- `/stats`

Public-safe:
- `/whoami`
- `/help`

### Private Commands

Linked user:
- `/start link_<token>`
- `/me`
- `/myalerts`
- `/mute`
- `/unmute`
- `/unlink`
- `/myimages`
- `/mycow`
- `/myabnormal`

Linked web admin or env admin in private chat may also use admin/system commands:
- `/status`
- `/latest`
- `/listcow`
- `/cow`
- `/abnormal`
- `/stats`
- `/qa`
- `/mark`
- `/note`

Private commands must be scoped to the linked web user only. Admin/system commands may show system-wide data only when the Telegram user is linked to a web account with `role=admin`. `TELEGRAM_ADMIN_USER_IDS` is fallback/bootstrap only, not the main permission source.

## Failure Handling

| Failure | Expected Behavior |
|---|---|
| Invalid link token | Bot replies token invalid/expired |
| Used link token | Bot replies token already used |
| User has not started bot | Private alert skipped, upload still succeeds |
| Telegram API down | Event succeeds, warning logged |
| Group topic closed | Bot may still post if admin; if fails, log warning |
| Non-admin group command | Bot denies with admin-only message |
| Private send fails | Do not retry forever; log safe warning |

## QA Validation Checklist

### Link Flow

- User can create Telegram link from web.
- Link opens correct bot.
- `/start link_<token>` links correct web account.
- Expired token is rejected.
- Used token is rejected.
- `/me` shows correct linked account.

### Private Alert Flow

- Linked user uploads image and receives private alert.
- Unlinked user uploads image and does not receive private alert.
- User A never receives User B image alert.
- `/mute` stops private alerts.
- `/unmute` resumes private alerts.
- `/unlink` removes private alert routing.

### Group Admin Flow

- Upload still appears in Image Upload Alerts topic.
- Abnormal image appears in Abnormal Detection topic.
- Admin can use `/qa`, `/mark`, `/note` in group.
- Non-admin cannot use sensitive group commands.
- QA callback buttons require admin.

### Security Flow

- No token appears in Telegram messages.
- No DB password appears in `/status`.
- No private link token appears in group.
- No other user data appears in private chat.

## Implemented API Surface

Web endpoints for linked users:

```text
GET  /api/me/telegram-link
POST /api/me/telegram-link-token
POST /api/me/telegram-unlink
```

Telegram private commands:

```text
/start link_<token>
/me
/myalerts
/mute
/unmute
/unlink
/myimages
/mycow
/myabnormal
```

## Success Metrics

- 100% linked users receive own upload alert during manual test.
- 0 private alerts delivered to wrong user.
- 0 sensitive secrets exposed in Telegram.
- Group QA flow remains working after private alerts are added.
- Upload API response does not depend on Telegram success.

## Open Questions

- Should admin users also receive private copies of all critical abnormal alerts?
- Should normal users see admin QA notes verbatim or summarized?
- Should Telegram linking be required before image upload, or optional?
