# Telegram Message Text Reference

Tài liệu này mô tả chính xác các text mà user/admin sẽ thấy trong Telegram private chat và group topics, theo code hiện tại trong `telegram-notifier.js`, `telegram-command-router.js`, và `server.js`.

## Quy Ước Hiển Thị

- **Private chat**: dành cho từng user, không hiện `tg_id`/audit nội bộ trừ `/whoami`.
- **Group topics**: dành cho admin/QA, luôn ưu tiên hiện danh tính hệ thống và Telegram khi có dữ liệu.
- **Group identity block**:

```text
Web account: <username/email> | web_id=<web_user_id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
```

Nếu chưa link Telegram:

```text
Telegram: not linked
```

## Private Chat - User Nhìn Thấy

### `/start`

```text
[BOT] COW VISIONING QA

Hello: <Telegram name>
Website: https://pctsv.io.vn
Database: Local PostgreSQL
Tunnel: Cloudflare Tunnel
Images: <total_images>
Users: <total_users>
Status: Online

Choose a quick action below:
```

Buttons:

```text
Open Cow Visioning
Gallery | Collect Images
System Status | Latest Image
Upload Topic | Abnormal Topic
```

### `/start link_<token>`

Success:

```text
✅ Telegram linked to Cow Visioning
Account: <web_username>
Role: <role>
You will receive private alerts for your own cow images.
```

Fail:

```text
❌ Link is invalid, expired, or already used. Please create a new link from the web app.
```

### `/help`

```text
[BOT] Cow Visioning commands

/start - Open bot menu
/help - Show commands
/whoami - Show your bot identity

Admin/group commands:
/status - Check server status
/latest [limit] - Latest cow images
/listcow <behavior> [limit] - Filter by behavior
/cow <cow_id> [limit] - Cow image history
/qa [abnormal|failed|review] [limit] - Admin QA queue
/mark <image_id> <behavior> - Admin mark behavior
/note <image_id> <text> - Admin add QA note
/stats [today|week|month] - Upload stats

Private user commands:
/me - Linked web account summary
/myalerts - Private alert status
/mute - Mute private alerts
/unmute - Enable private alerts
/myimages [limit] - Your latest images
/mycow <cow_id> [limit] - Your cow history
/myabnormal [limit] - Your abnormal images
```

### `/whoami` trong private

```text
[IDENTITY] Cow Visioning private chat
Telegram: <@username or name>
Linked account: <web_username or not linked>
Web role: <role or n/a>
Admin: yes|no
```

### `/me`

Linked:

```text
👤 Cow Visioning account
Username: <web_username>
Role: <role>
Alerts: enabled|muted
Linked: <date_time>
```

Not linked:

```text
🔗 Your Telegram is not linked yet. Open the connect link from Cow Visioning web account.
```

### `/myalerts`

```text
🔔 Private alerts are enabled|muted for <web_username>.
Use /mute or /unmute to change this.
```

### `/mute` và `/unmute`

```text
🔕 Private alerts muted.
```

```text
🔔 Private alerts enabled.
```

### `/unlink`

Not linked:

```text
Telegram is not linked.
```

Success:

```text
✅ Telegram unlinked from Cow Visioning.
```

### Private upload notification

Khi user upload ảnh và đã link Telegram:

```text
Your cow image was saved

Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: <behavior>
Confidence: <percent or n/a>
AI: <provider> / <status>
View: <public_image_url>
```

Button:

```text
View Image
```

Nếu behavior là `abnormal`, user nhận thêm:

```text
⚠️ Abnormal behavior detected in your image #<image_id>. Please review it when possible.
```

### `/myimages`, `/mycow`, `/myabnormal`

Mỗi ảnh trả về dạng card tương tự:

```text
<title>

Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: <behavior>
Confidence: <percent or n/a>
AI: <provider> / <status>
Uploaded by: <web_username>
Time: <date_time>
View: <public_image_url>
```

Nếu không có dữ liệu:

```text
📭 No cow images found.
Query: <query_title>
```

## Group Topics - Admin Nhìn Thấy

### Topic 4 - Image Upload Alerts

Khi upload ảnh thành công:

```text
[UPLOAD] New cow image uploaded

Web account: <username> | web_id=<id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: <behavior>
Confidence: <percent or n/a>
AI: <provider> / <status>
Captured: <date_time>
View: <public_image_url>

Admin actions: Confirm OK | Mark Abnormal | Need Review
```

Buttons:

```text
Open Image | Confirm OK
Mark Abnormal | Need Review
```

### Topic 6 - AI Tool Pro Logs

Khi ảnh có AI/Tool Pro/Yolo processing:

```text
[AI] <provider_label> status: <status_label>

Web account: <username> | web_id=<id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: <behavior>
Confidence: <percent or n/a>
Provider: <ai_provider>
Status: <ai_status>
Model: <ai_model_name>
Inference: <ms or n/a>
Source: <source>
Detail: <safe error/message summary, only if exists>
View: <public_image_url>
```

Provider labels thực tế:

```text
Tool Pro
AI YOLO
Manual / AI off
```

Status labels thực tế:

```text
Completed
Failed
Pending
Skipped
Disabled
Tool Pro off
```

### Topic 9 - Abnormal Detection

Khi `behavior = abnormal`:

```text
[ABNORMAL] Cow behavior needs attention

Web account: <username> | web_id=<id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: abnormal
Confidence: <percent or n/a>
Captured: <date_time>
View: <public_image_url>

Recommended: open image, confirm if true abnormal, or mark Need Review.
```

### Topic 7 - User Activity

Khi link Telegram:

```text
🔗 Telegram linked
User: <web_username>
Role: <role>
Telegram ID: <telegram_user_id>
```

Khi admin bấm callback QA button:

```text
[QA_ACTION] CONFIRM_OK|MARK_ABNORMAL|NEED_REVIEW

Web account: <username> | web_id=<id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
Image ID: #<image_id>
Cow ID: <cow_id>
Previous behavior: <behavior>
AI status: <ai_status>
Time: <date_time>
Result: success
```

### Topic 8 - System / Server Status

Khi gọi `/status` hoặc bấm `System Status`:

```text
[SYSTEM] Cow Visioning Status

Web: https://pctsv.io.vn
Database: Local PostgreSQL
Tunnel: Cloudflare Tunnel
Total images: <count>
Total users: <count>
Time: <date_time>
Status: Online

AI enabled: true|false
Tool Pro enabled: true|false
AI device: <cpu/cuda/...>
AI model: <model_name>
AI backend: <backend>
```

Khi admin đổi setting trong web:

```text
[SETTINGS] System settings changed

Web account: <username> | web_id=<id> | role=<role>
Telegram: <telegram_username> | tg_id=<telegram_user_id>
Time: <date_time>

Changed fields:
* <SETTING_KEY>: <old_value> -> <new_value>
```

Khi gửi test notification:

```text
[TEST] Cow Visioning Telegram test
Topic: <topic_key>
User: <admin_username>
Time: <iso_time>
```

### Topic 5 - Cow Behavior

Hiện tại topic này đang reserved, chưa có auto-notification cố định trong code.

## Callback Toast Texts

| Callback | User sees as Telegram toast |
|---|---|
| `menu:status` | `Status sent to System topic` |
| `menu:latest` | `Latest image sent to chat` |
| `menu:uploads` | `Upload alerts appear in Image Upload Alerts topic` |
| `menu:abnormal` | `Abnormal alerts appear in Abnormal Detection topic` |
| `qa:confirm:<id>` | `Image #<id> confirmed OK` |
| `qa:abnormal:<id>` | `Image #<id> marked abnormal` |
| `qa:review:<id>` | `Image #<id> marked need review` |
| unsupported callback | `Unsupported button action` |
| non-admin callback | `Admin only action. Link a web admin account first.` |
| image not found | `Image #<id> not found` |
| callback error | `Action failed, try again` |
| menu error | `Menu action failed` |

## Group Command Responses

### `/whoami` trong group

```text
[IDENTITY] Telegram group actor
Telegram user ID: <telegram_user_id>
Telegram username: <@username>
Telegram name: <name>
Group chat ID: <group_chat_id>
Chat type: <chat_type>
Topic ID: <topic_id or General>
Web account: <web_username or not linked>
Web user ID: <web_user_id or n/a>
Web role: <role or n/a>
Private chat ID: <telegram_chat_id or n/a>
Env admin: yes|no
Web admin: yes|no
Admin: yes|no
```

### `/latest`, `/listcow`, `/cow`, `/qa`

Trả summary trước:

```text
<title>
Found: <n> result(s). Sending cards...
```

Sau đó gửi từng image card:

```text
<title>

Image ID: #<image_id>
Cow ID: <cow_id>
Area: <barn_area>
Behavior: <behavior>
Confidence: <percent or n/a>
AI: <provider> / <status>
Uploaded by: <web_username>
Time: <date_time>
View: <public_image_url>
```

### `/stats [today|week|month]`

```text
📊 Stats: <period>

Images: <total>
Abnormal: <count>
AI completed: <count>
AI failed: <count>
Latest: <date_time>

Behaviors:
- standing: <count>
- eating: <count>
```

### `/mark <image_id> <behavior>`

```text
✅ Marked image #<image_id> as <behavior>
```

### `/note <image_id> <text>`

```text
📝 Added note to image #<image_id>
```

## Denied / Error Messages

| Case | Text |
|---|---|
| Private admin command but not admin | `🔒 Admin only command. Link a web admin account or ask system admin to allow your Telegram ID.` |
| Group admin command but not admin | `🔒 Admin only command. Link this Telegram to a web admin account first.` |
| Private command used in group | `🔐 Please use this command in private chat with the bot.` |
| Not allowed | `⛔ You are not allowed to use this bot.` |
| Unknown command | `Unknown command. Try /help` |
| Command handler throws | `⚠️ Command failed: <error message>` |
| Invalid `/cow` | `Usage: /cow <cow_id> [limit]` |
| Invalid `/listcow` | `Usage: /listcow <behavior> [limit>\nValid: standing, lying, eating, drinking, walking, abnormal` |
| Invalid `/stats` | `Usage: /stats [today|week|month]` |
| Invalid `/qa` | `Usage: /qa [abnormal|failed|review] [limit]` |
| Invalid `/mark` | `Usage: /mark <image_id> <behavior>\nValid: standing, lying, eating, drinking, walking, abnormal` |
| Invalid `/note` | `Usage: /note <image_id> <text>` |

## Private vs Group Summary

| Event | Private chat | Group topic |
|---|---|---|
| Image uploaded | Owner receives photo + caption | Topic 4 gets admin card + QA buttons |
| Abnormal image | Owner receives warning text | Topic 9 gets abnormal alert |
| AI completed/failed | Not sent privately | Topic 6 gets AI technical log |
| Telegram linked | User receives confirmation | Topic 7 receives audit log |
| QA button pressed | No private message | Topic 7 receives audit log |
| Settings changed | No private message | Topic 8 receives changed field diff |
| `/whoami` | Short identity | Full audit identity |
