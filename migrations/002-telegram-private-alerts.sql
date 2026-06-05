-- Telegram private user alert linking

CREATE TABLE IF NOT EXISTS user_telegram_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    telegram_username VARCHAR(255),
    telegram_chat_id BIGINT NOT NULL,
    linked_at TIMESTAMP DEFAULT NOW(),
    unlinked_at TIMESTAMP,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_telegram_accounts_active_user
    ON user_telegram_accounts (user_id)
    WHERE unlinked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_telegram_accounts_active_telegram_user
    ON user_telegram_accounts (telegram_user_id)
    WHERE unlinked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_telegram_accounts_user_id
    ON user_telegram_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_user_telegram_accounts_telegram_user_id
    ON user_telegram_accounts (telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id
    ON telegram_link_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires_at
    ON telegram_link_tokens (expires_at);
