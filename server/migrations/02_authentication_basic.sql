CREATE TABLE IF NOT EXISTS "user" (
    user_id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_auth_link (
    user_id UUID NOT NULL,
    auth_id TEXT NOT NULL,
    identifier TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, auth_id),
    FOREIGN KEY (user_id) REFERENCES "user" (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_token (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    auth_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,

    FOREIGN KEY (user_id) REFERENCES "user" (user_id) ON DELETE CASCADE
);