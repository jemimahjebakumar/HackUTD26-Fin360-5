import { schema, table, t } from "spacetimedb/server";

// ============================================================
// USERS & AUTHENTICATION
// ============================================================

const users = table(
  { name: "users" },
  {
    id: t.string().primaryKey(),
    name: t.string(),
  }
);

const auth_sessions = table(
  { name: "auth_sessions" },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),
    token: t.string().unique(),
    created_at: t.timestamp(),
    expires_at: t.timestamp(),
  }
);

// ============================================================
// FINANCIAL CONNECTIONS
// ============================================================

const connections = table(
  { name: "connections" },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),

    external_connection_id: t.string().unique(),
    institution_id: t.string(),
    institution_name: t.string(),

    status: t.string(),
    connected_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

// ============================================================
// FINANCIAL ACCOUNTS
// ============================================================

const accounts = table(
  { name: "accounts" },
  {
    id: t.string().primaryKey(),
    connection_id: t.string().index("btree"),

    external_account_id: t.string().unique(),

    name: t.string(),
    account_type: t.string(),
    currency: t.string(),

    balance: t.f64(),

    // Credit card-specific information
    credit_limit: t.option(t.f64()),
    payment_due_date: t.option(t.timestamp()),

    updated_at: t.timestamp(),
  }
);

// ============================================================
// TRANSACTIONS
// ============================================================

const transactions = table(
  { name: "transactions" },
  {
    id: t.string().primaryKey(),
    external_transaction_id: t.string().unique(),

    account_id: t.string().index("btree"),

    description: t.string(),
    category: t.string(),
    amount: t.f64(),

    date: t.timestamp(),
  }
);

// ============================================================
// INVESTMENT HOLDINGS
// ============================================================

const holdings = table(
  { name: "holdings" },
  {
    id: t.string().primaryKey(),
    account_id: t.string().index("btree"),

    symbol: t.string(),
    name: t.string(),

    quantity: t.f64(),
    market_value: t.f64(),
    cost_basis: t.f64(),

    updated_at: t.timestamp(),
  }
);

// ============================================================
// LOANS
// ============================================================

const loan_details = table(
  { name: "loan_details" },
  {
    account_id: t.string().primaryKey(),

    original_principal: t.f64(),
    remaining_principal: t.f64(),
    amount_owed: t.f64(),

    interest_rate: t.f64(),
    interest_type: t.string(),

    minimum_payment: t.f64(),
    next_due_date: t.option(t.timestamp()),
    expected_payoff_date: t.option(t.timestamp()),
  }
);

// ============================================================
// USER-TRACKED ASSETS
// ============================================================

const assets = table(
  { name: "assets" },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),

    name: t.string(),
    asset_type: t.string(),

    estimated_value: t.f64(),
    updated_at: t.timestamp(),
  }
);

/*
// ============================================================
// FINANCIAL GOALS
// ============================================================

const financial_goals = table(
  { name: "financial_goals" },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),

    name: t.string(),
    description: t.string(),

    target_amount: t.f64(),
    target_date: t.option(t.timestamp()),

    status: t.string(),
    created_at: t.timestamp(),
  }
);
*/

// ============================================================
// REGISTER SCHEMA
// ============================================================

const spacetimedb = schema({
  users,
  auth_sessions,
  connections,
  accounts,
  transactions,
  holdings,
  loan_details,
  assets,
  {
    env: {
      MOCK_API_KEY: t.string(),
      MOCK_API_URL: t.string(),
      WEBHOOK_SECRET
    }
  }
/*  financial_goals, */
});

export default spacetimedb;

export const init = spacetimedb.init((_ctx) => {
  // Fill users with hardcoded users  
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
});

// REDUCERS (change the database)

