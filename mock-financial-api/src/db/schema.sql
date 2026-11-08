CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Simulated customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL
);

-- Financial institutions
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    institution_type VARCHAR(50) NOT NULL
);

-- Accounts belonging to simulated customers
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    institution_id UUID NOT NULL REFERENCES institutions(id),

    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL,
    account_mask VARCHAR(4),

    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),

    description VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    amount NUMERIC(15, 2) NOT NULL,
    transaction_date DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investment holdings
CREATE TABLE investment_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),

    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    shares NUMERIC(15, 6) NOT NULL,
    price_per_share NUMERIC(15, 2) NOT NULL
);

-- Additional loan information
CREATE TABLE loans (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),

    original_principal NUMERIC(15, 2) NOT NULL,
    remaining_principal NUMERIC(15, 2) NOT NULL,
    interest_rate NUMERIC(7, 4) NOT NULL,
    interest_type VARCHAR(30) NOT NULL,
    minimum_payment NUMERIC(15, 2),
    due_date DATE
);

-- Simulated authorization sessions
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id VARCHAR(100) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    institution_id UUID NOT NULL REFERENCES institutions(id),

    authorization_token VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Connections established by your application
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id VARCHAR(100) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    institution_id UUID NOT NULL REFERENCES institutions(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts included in a connection
CREATE TABLE connection_accounts (
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    PRIMARY KEY (connection_id, account_id)
);

-- Webhook destinations registered by your application
CREATE TABLE webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id VARCHAR(100) NOT NULL,
    callback_url TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

-- Useful indexes
CREATE INDEX idx_accounts_customer
    ON accounts(customer_id);

CREATE INDEX idx_accounts_institution
    ON accounts(institution_id);

CREATE INDEX idx_transactions_account_date
    ON transactions(account_id, transaction_date DESC);

CREATE INDEX idx_connections_app_user
    ON connections(app_user_id);
