# Telegram QA Topics

## Purpose

This document explains every Telegram forum topic used by Cow Visioning QA.

It answers:
- what each topic is for
- when the system sends messages there
- required trigger conditions
- who should read/respond
- what data is safe to show

## Topic Environment Mapping

| Topic | Env Key | Current ID | Main Audience |
|---|---|---:|---|
| Image Upload Alerts | `TELEGRAM_TOPIC_IMAGE_UPLOAD_ALERTS` | `4` | Admin, QA |
| Cow Behavior | `TELEGRAM_TOPIC_COW_BEHAVIOR` | `5` | Admin, QA |
| AI Tool Pro Logs | `TELEGRAM_TOPIC_AI_TOOL_PRO_LOGS` | `6` | Admin, Dev/Ops |
| User Activity | `TELEGRAM_TOPIC_USER_ACTIVITY` | `7` | Admin |
| System / Server Status | `TELEGRAM_TOPIC_SYSTEM_STATUS` | `8` | Admin, Dev/Ops |
| Abnormal Detection | `TELEGRAM_TOPIC_ABNORMAL_DETECTION` | `9` | Admin, QA, farm operator |

## Global Routing Rules

- Group topics are admin/QA/system channels.
- User-private alerts go to private bot chat, not group topics.
- Every group-topic notification that has a user actor/uploader must show both identities:
  - Web account: username/email, `web_id`, role.
  - Telegram account: Telegram username, `tg_id`, or `not linked`.
- Private bot chat messages must stay user-friendly and must not show Telegram ID/internal admin audit fields unless the user explicitly runs a diagnostic command.
- Upload success must not fail if Telegram send fails.
- Telegram messages must never include API keys, DB passwords, session IDs, raw stack traces, or private link tokens.
- Closed topics can still receive bot messages if the bot has permission.
- QA action buttons and mutating commands require Telegram account linked to a web account with `role=admin`. Env allowlist is fallback/bootstrap only.

## Shared Group Identity Format

All admin-facing group topics use the same actor/uploader identity block when an actor is known.

```text
Web account: <username-or-email> | web_id=<web_user_id> | role=<role>
Telegram: <@telegram_username> | tg_id=<telegram_user_id>
```

If the web account is not linked to Telegram yet:

```text
Web account: <username-or-email> | web_id=<web_user_id> | role=<role>
Telegram: not linked
```

Private chat intentionally uses a shorter format:

```text
Cow Visioning account
Username: <username>
Role: <role>
Alerts: enabled|muted
```

## Topic Notification Format Matrix

| Topic | Format Type | Must Include | Image Required | Buttons | Identity Rule |
|---|---|---|---|---|---|
| Image Upload Alerts | Upload photo card | Web/Telegram identity, image ID, cow ID, area, behavior, confidence, AI provider/status, captured time, public link | Yes when local file exists | View Image, Confirm, Mark Abnormal, Need Review | Shared group identity |
| Cow Behavior | Behavior summary/card | Behavior, cow ID or count, confidence/count, time window, gallery/filter link when available | Optional | Optional filter/detail buttons | Shared group identity if actor exists |
| AI Tool Pro Logs | AI processing photo card | Web/Telegram identity, image ID, provider, status, model, inference time, source, behavior, confidence, safe failure summary, public link | Yes when local file exists | View Image | Shared group identity |
| User Activity | Audit text log | Web/Telegram identity, action name, role, target image/cow if relevant, timestamp, result | No | Usually no | Shared group identity |
| System / Server Status | System text log | Web/Telegram identity for admin actions, event type, public URL/status, DB/tunnel summary, changed fields old/new, timestamp | No | Optional status/menu buttons | Shared group identity for admin-triggered events |
| Abnormal Detection | Urgent photo/card | Web/Telegram identity, image ID, cow ID, area, confidence, timestamp, public link | Yes when local file exists | View Image, Confirm, Mark Abnormal, Need Review | Shared group identity |

## Severity Model

| Severity | Use When | Expected Action |
|---|---|---|
| Info | Normal successful event | No urgent action |
| Warning | AI/tool/user flow needs attention | Check within working session |
| Critical | Abnormal cow behavior or urgent QA | Review quickly |
| System | Server, tunnel, DB, webhook health | Admin/dev checks infrastructure |

## Topic Details

## Image Upload Alerts

### Purpose

Central feed for every cow image uploaded or captured through Cow Visioning web.

Use this topic to verify:
- upload pipeline works
- image file is saved
- DB insert succeeded
- metadata is correct
- QA buttons are available

### Sends When

The system sends here after `POST /api/images` succeeds and a `cow_images` row exists.

### Required Conditions

- `TELEGRAM_NOTIFICATIONS_ENABLED=true`
- `TELEGRAM_BOT_TOKEN` configured
- `TELEGRAM_CHAT_ID` configured
- `TELEGRAM_TOPIC_IMAGE_UPLOAD_ALERTS=4`
- upload request completed successfully
- image record has been inserted into `cow_images`

### Message Should Include

- image preview when local file exists
- web account username/email, web user ID, role
- Telegram username and Telegram user ID, or `not linked`
- image ID
- cow ID
- behavior
- barn/area
- AI confidence/status/provider
- uploader username/ID for admin QA
- public image link
- QA buttons: View Image, Confirm, Mark Abnormal, Need Review

### Should Not Include

- user email by default
- private Telegram link token
- DB path/password
- full internal error object

### Who Acts

- QA reviews image quality.
- Admin checks upload reliability.
- Operator can use buttons if admin-authorized.

## Cow Behavior

### Purpose

Behavior-specific operational stream.

Use this topic for summarized behavior classification events, trends, or behavior-specific QA review.

### Sends When

Currently reserved for behavior notifications and future behavior summaries.

Recommended future triggers:
- behavior classifier completes with valid behavior
- scheduled behavior summary is generated
- high-confidence behavior trend is detected

### Required Conditions

- valid behavior is one of: `standing`, `lying`, `eating`, `drinking`, `walking`, `abnormal`
- topic configured as `TELEGRAM_TOPIC_COW_BEHAVIOR=5`
- notification type is behavior summary, not urgent abnormal alert

### Message Should Include

- behavior name
- cow ID or aggregate count
- confidence or count
- time window
- link to gallery/filter when available

### Who Acts

- QA validates classification quality.
- Admin reviews trends.

## AI Tool Pro Logs

### Purpose

Technical log stream for OpenAI/Tool Pro processing.

Use this topic to debug AI processing, not normal user communication.

### Sends When

The system sends here when an image uses Tool Pro/OpenAI or AI status is relevant.

Current trigger examples:
- `ai_provider = tool_pro`
- `ai_status = completed`
- `ai_status = failed`

### Required Conditions

- `TELEGRAM_TOPIC_AI_TOOL_PRO_LOGS=6`
- AI/Tool Pro status exists on image
- event is AI-processing-related

### Message Should Include

- image ID
- AI provider
- AI status
- model name if safe
- confidence if available
- failure summary if failed
- web account + Telegram identity for uploader/admin actor
- image preview when local file exists
- public image link and View Image button when available

### Should Not Include

- OpenAI API key
- raw full API response if it may contain sensitive data
- full stack trace
- large JSON payload

### Who Acts

- Admin checks if AI is healthy.
- Developer/operator checks failed AI jobs.

## User Activity

### Purpose

Audit trail for important account, linking, and QA actions.

Use this topic to answer: who did what, when, and from where.

### Sends When

Current/final target triggers:
- user registration success
- login/logout summary if enabled later
- Telegram account linked
- Telegram account unlinked
- admin presses QA callback button
- admin uses `/mark` or `/note`
- admin sends manual test notification to this topic

### Required Conditions

- `TELEGRAM_TOPIC_USER_ACTIVITY=7`
- action has a user/admin actor
- action is audit-worthy but not infrastructure-only

### Message Should Include

- actor username
- actor role
- web account ID
- Telegram username and Telegram user ID for linking/QA events
- action name
- image ID/cow ID if relevant
- timestamp
- result: success/failure when useful

### Should Not Include

- password/email verification secrets
- session IDs
- private link token
- user email unless admin policy later requires it

### Who Acts

- Admin audits account activity.
- QA tracks who changed image status.

## System / Server Status

### Purpose

Infrastructure and health status channel.

Use this topic for server, local laptop hosting, Cloudflare Tunnel, DB, webhook, and bot health.

### Sends When

Current/final target triggers:
- `/status` command in group/admin mode
- menu button `Status`
- manual admin Telegram test to `systemStatus`
- system online event when web server starts successfully
- system offline event when graceful shutdown is detected
- DB/tunnel/webhook failure alerts
- admin changes system settings, especially AI/Tool Pro/notification settings
- admin changes runtime/system configuration from web admin panel

### Required Conditions

- `TELEGRAM_TOPIC_SYSTEM_STATUS=8`
- event is operational/system-level
- no private user data is required

### Message Should Include

- web public URL
- database status summary, e.g. Local PostgreSQL
- tunnel status summary, e.g. Cloudflare Tunnel
- total users/images when safe
- server time
- status result

For online/offline events:
- event type: `Online` or `Offline`
- service name, e.g. Cow Visioning Web
- public URL
- port
- environment, e.g. production/local
- timestamp
- reason when offline if known

For setting-change events:
- actor web account, web user ID, role
- actor Telegram username and Telegram user ID, or `not linked`
- setting group, e.g. AI Detection Configuration
- changed field name
- old value
- new value
- timestamp
- result: success/failure

Example setting-change message:

```text
?? System setting changed

Web account: admin | web_id=1 | role=admin
Telegram: @wpcadminsss | tg_id=6666230458
Section: AI Detection Configuration
Field: Tool Pro Enabled
Old: false
New: true
Time: 2026-05-03 14:25:00
Result: success
```

Example online message:

```text
🟢 Cow Visioning Online

🌐 Web: https://pctsv.io.vn
🔌 Port: 2609
🗄 Database: Local PostgreSQL
🚇 Tunnel: Cloudflare Tunnel
🕒 Time: 2026-05-03 14:25:00
✅ Status: online
```

Example offline message:

```text
🔴 Cow Visioning Offline

🌐 Web: https://pctsv.io.vn
🕒 Time: 2026-05-03 23:10:00
⚠️ Reason: graceful shutdown
```

### Should Not Include

- DB host password
- `.env` values
- API keys
- local absolute paths unless debugging privately
- stack traces
- unchanged settings
- full config objects

### Who Acts

- Admin checks uptime.
- Dev/Ops verifies laptop-hosted production state.
- Admin reviews setting-change audit and confirms whether the change was intentional.
- Dev/Ops investigates offline/failure events quickly because this laptop is the production host.

## Abnormal Detection

### Purpose

Urgent QA channel for abnormal cow behavior.

This is the highest-priority animal-health topic.

### Sends When

The system sends here when an uploaded/captured image has:

```text
behavior = abnormal
```

or when admin/QA marks an image abnormal through Telegram buttons or commands.

### Required Conditions

- `TELEGRAM_TOPIC_ABNORMAL_DETECTION=9`
- image behavior is `abnormal`, or QA/admin explicitly marks abnormal
- image record exists in DB

### Message Should Include

- image ID
- cow ID
- barn/area
- confidence
- uploader web account, web user ID, role
- uploader Telegram username and Telegram user ID, or `not linked`
- image link
- timestamp
- QA action buttons when applicable

### Should Not Include

- unrelated user data
- private chat link token
- raw AI payload

### Who Acts

- QA/admin quickly reviews image.
- Farm operator checks cow if alert is credible.
- Admin can mark Confirm / Need Review / Mark Abnormal.

## Private User Alerts vs Group Topics

Private bot chat sends owner-specific alerts.

| Event | Private User | Group Topic |
|---|---|---|
| Own image uploaded | Yes | Image Upload Alerts |
| Own image abnormal | Yes, urgent | Abnormal Detection |
| Own AI failed | Yes | AI Tool Pro Logs |
| Admin QA note on own image | Yes | User Activity |
| System health issue | No | System / Server Status |
| Other user upload | No | Image Upload Alerts |

## Current Implementation Notes

Current code routes:
- upload success to `Image Upload Alerts`
- abnormal behavior to `Abnormal Detection`
- Tool Pro status/failure to `AI Tool Pro Logs`
- Telegram linked and QA button activity to `User Activity`
- `/status` and menu status to caller topic; recommended use is `System / Server Status`
- private upload alerts to linked user private chat

Reserved/future behavior:
- `Cow Behavior` topic is reserved for behavior summaries/trends unless explicitly wired for every non-abnormal behavior.
- automated server health alerts are documented but not fully automated unless a health scheduler is added.

## QA Checklist By Topic

### Image Upload Alerts

- Upload one image.
- Confirm photo/message appears in topic.
- Confirm image ID/cow ID/behavior are correct.
- Confirm QA buttons appear.

### Abnormal Detection

- Upload or mark image as `abnormal`.
- Confirm message appears in abnormal topic.
- Confirm it includes image ID, cow ID, confidence, and link.

### AI Tool Pro Logs

- Upload image with Tool Pro enabled.
- Confirm completed or failed status appears.
- Confirm no API key/raw secret appears.

### User Activity

- Link Telegram account.
- Confirm username, role, Telegram ID appear.
- Use QA button or `/note`.
- Confirm actor/action/image ID appear.

### System / Server Status

- Run `/status` from System topic or status menu.
- Confirm public URL, DB summary, image/user counts, time, status.
- Confirm no secrets appear.

### Cow Behavior

- When behavior summaries are enabled, confirm valid behavior label and counts.
- Confirm abnormal events go to Abnormal Detection, not only this topic.

## Operational Recommendations

- Keep log topics closed to normal members if possible.
- Keep bot admin so it can post into closed topics.
- Use `User Activity`, `System / Server Status`, `Image Upload Alerts`, and `Abnormal Detection` as primary operational topics.
- Treat `Cow Behavior` as optional summary/trend topic until a dedicated behavior analytics phase exists.
- Do not use group topics for private user support messages.
