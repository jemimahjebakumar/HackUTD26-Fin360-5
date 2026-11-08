import { Timestamp } from "spacetimedb";
import {
  Router,
  SyncResponse,
  schema,
  table,
  t,
} from "spacetimedb/server";

// -----------------------------------------------------------------------------
// DEMO USERS
// Replace the three externalId values with the customer UUIDs printed by
// `npm run seed` in your Mock Financial API project.
// -----------------------------------------------------------------------------

const DEMO_USERS = [
  {
    id: "alex",
    name: "Alex Morgan",
    externalId: "REPLACE_WITH_ALEX_CUSTOMER_UUID",
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    externalId: "REPLACE_WITH_JORDAN_CUSTOMER_UUID",
  },
  {
    id: "taylor",
    name: "Taylor Brooks",
    externalId: "REPLACE_WITH_TAYLOR_CUSTOMER_UUID",
  },
];

// -----------------------------------------------------------------------------
// TABLES
//
// The financial tables below are public so the React demo can subscribe to
// them without a separate authentication/authorization system. This is ONLY
// suitable for seeded mock data. Every client can read every row in a public
// table. Do not put real financial data in this configuration.
// -----------------------------------------------------------------------------

const users = table(
  { name: "users", public: true},
  {
    id: t.string().primaryKey(),
    name: t.string(),
    external_customer_id: t.string().unique(),
  },
);

const connections = table(
  { name: "connections", public: true },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),
    external_connection_id: t.string().unique(),
    institution_id: t.string(),
    institution_name: t.string(),
    status: t.string(),
    connected_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const accounts = table(
  { name: "accounts", public: true },
  {
    id: t.string().primaryKey(),
    connection_id: t.string().index("btree"),
    external_account_id: t.string().unique(),
    name: t.string(),
    account_type: t.string(),
    account_mask: t.option(t.string()),
    currency: t.string(),
    balance: t.f64(),
    updated_at: t.timestamp(),
  },
);

const transactions = table(
  { name: "transactions", public: true },
  {
    id: t.string().primaryKey(),
    external_transaction_id: t.string().unique(),
    account_id: t.string().index("btree"),
    description: t.string(),
    category: t.option(t.string()),
    amount: t.f64(),
    date: t.timestamp(),
  },
);

const holdings = table(
  { name: "holdings", public: true },
  {
    id: t.string().primaryKey(),
    account_id: t.string().index("btree"),
    external_holding_id: t.string().unique(),
    symbol: t.string(),
    name: t.string(),
    quantity: t.f64(),
    market_value: t.f64(),
    price_per_share: t.f64(),
    updated_at: t.timestamp(),
  },
);

const loan_details = table(
  { name: "loan_details", public: true },
  {
    account_id: t.string().primaryKey(),
    original_principal: t.f64(),
    remaining_principal: t.f64(),
    amount_owed: t.f64(),
    interest_rate: t.f64(),
    interest_type: t.string(),
    minimum_payment: t.option(t.f64()),
    next_due_date: t.option(t.timestamp()),
  },
);

const assets = table(
  { name: "assets", public: true },
  {
    id: t.string().primaryKey(),
    user_id: t.string().index("btree"),
    name: t.string(),
    asset_type: t.string(),
    estimated_value: t.f64(),
    updated_at: t.timestamp(),
  },
);

// Stores successful webhook IDs so retries from the Mock API are idempotent.
// This table is intentionally private: clients do not need to subscribe to it.
const webhook_events = table(
  { name: "webhook_events" },
  {
    event_id: t.string().primaryKey(),
    connection_id: t.string(),
    account_id: t.string(),
    received_at: t.timestamp(),
  },
);

const spacetimedb = schema(
  {
    users,
    connections,
    accounts,
    transactions,
    holdings,
    loan_details,
    assets,
    webhook_events,
  },
  {
    env: {
      MOCK_API_KEY: t.string(),
      MOCK_API_URL: t.string(),
      MOCK_WEBHOOK_SECRET: t.string(),
    },
  },
);

export default spacetimedb;

// -----------------------------------------------------------------------------
// SHARED HELPERS
// -----------------------------------------------------------------------------

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing or invalid '${field}'`);
  }
  return value;
}

function numeric(value: unknown, field: string): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(`Missing or invalid numeric field '${field}'`);
  }
  return result;
}

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined || value === ""
    ? undefined
    : String(value);
}

function timestamp(value: unknown, fallback: Timestamp): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value === null || value === undefined || value === "") return fallback;

  const input = String(value);
  // PostgreSQL DATE values are serialized as YYYY-MM-DD. Interpret them as
  // midnight UTC so every runtime stores the same instant.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? `${input}T00:00:00.000Z`
    : input;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date/timestamp value: ${input}`);
  }
  return Timestamp.fromDate(date);
}

function apiUrl(ctx: any, path: string): string {
  const baseUrl = String(ctx.env.MOCK_API_URL).replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Synchronous outbound HTTP helper for SpacetimeDB procedures.
 * The Mock API protects /v1 routes with the x-api-key header.
 */
function mockApiRequest(
  ctx: any,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): any {
  const options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ctx.env.MOCK_API_KEY,
    },
  };

  if (body !== undefined) options.body = JSON.stringify(body);

  const response = ctx.http.fetch(apiUrl(ctx, path), options);
  const responseText = response.text();

  if (!response.ok) {
    throw new Error(
      `Mock API ${method} ${path} failed (${response.status}): ${responseText}`,
    );
  }

  if (responseText.trim() === "") return {};
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Mock API returned invalid JSON for ${method} ${path}`);
  }
}

function assertUserExists(ctx: any, userId: string): any {
  const user = ctx.db.users.id.find(userId);
  if (!user) throw new Error(`User '${userId}' was not found`);
  if (!user.external_customer_id || user.external_customer_id.startsWith("REPLACE_")) {
    throw new Error(
      `Set the seeded Mock API customer UUID for demo user '${userId}' in DEMO_USERS`,
    );
  }
  return user;
}

function saveConnectionData(
  tx: any,
  userId: string,
  localConnectionId: string,
  payload: any,
): { accountCount: number; transactionCount: number; holdingCount: number; loanCount: number } {
  const localConnection = tx.db.connections.id.find(localConnectionId);
  if (!localConnection || localConnection.user_id !== userId) {
    throw new Error("Connection does not belong to the selected demo user");
  }

  if (!payload || !Array.isArray(payload.accounts)) {
    throw new Error("Mock API connection data did not contain an accounts array");
  }

  let transactionCount = 0;
  let holdingCount = 0;
  let loanCount = 0;

  for (const providerAccount of payload.accounts) {
    const externalAccountId = requiredString(providerAccount.id, "account.id");

    syncAccountInternal(tx, {
      connection_id: localConnectionId,
      external_account_id: externalAccountId,
      name: requiredString(providerAccount.name, "account.name"),
      account_type: requiredString(providerAccount.account_type, "account.account_type"),
      account_mask: optionalString(providerAccount.account_mask),
      currency: optionalString(providerAccount.currency) ?? "USD",
      balance: numeric(providerAccount.balance, "account.balance"),
      updated_at: timestamp(providerAccount.updated_at, tx.timestamp),
    });

    if (!Array.isArray(providerAccount.transactions)) {
      throw new Error(`Account '${externalAccountId}' has an invalid transactions field`);
    }
    for (const providerTransaction of providerAccount.transactions) {
      syncTransactionInternal(tx, {
        external_transaction_id: requiredString(providerTransaction.id, "transaction.id"),
        account_id: externalAccountId,
        description: requiredString(providerTransaction.description, "transaction.description"),
        category: optionalString(providerTransaction.category),
        amount: numeric(providerTransaction.amount, "transaction.amount"),
        date: timestamp(providerTransaction.transaction_date, tx.timestamp),
      });
      transactionCount += 1;
    }

    if (!Array.isArray(providerAccount.holdings)) {
      throw new Error(`Account '${externalAccountId}' has an invalid holdings field`);
    }
    for (const providerHolding of providerAccount.holdings) {
      const quantity = numeric(providerHolding.shares, "holding.shares");
      const pricePerShare = numeric(providerHolding.price_per_share, "holding.price_per_share");
      syncHoldingInternal(tx, {
        external_holding_id: requiredString(providerHolding.id, "holding.id"),
        account_id: externalAccountId,
        symbol: requiredString(providerHolding.symbol, "holding.symbol"),
        name: requiredString(providerHolding.name, "holding.name"),
        quantity,
        price_per_share: pricePerShare,
        market_value: quantity * pricePerShare,
        updated_at: tx.timestamp,
      });
      holdingCount += 1;
    }

    if (providerAccount.loan) {
      const loan = providerAccount.loan;
      syncLoanInternal(tx, {
        account_id: externalAccountId,
        has_loan: true,
        original_principal: numeric(loan.original_principal, "loan.original_principal"),
        remaining_principal: numeric(loan.remaining_principal, "loan.remaining_principal"),
        interest_rate: numeric(loan.interest_rate, "loan.interest_rate"),
        interest_type: requiredString(loan.interest_type, "loan.interest_type"),
        minimum_payment:
          loan.minimum_payment === null || loan.minimum_payment === undefined
            ? undefined
            : numeric(loan.minimum_payment, "loan.minimum_payment"),
        next_due_date: loan.due_date
          ? timestamp(loan.due_date, tx.timestamp)
          : undefined,
      });
      loanCount += 1;
    } else {
      syncLoanInternal(tx, {
        account_id: externalAccountId,
        has_loan: false,
        original_principal: undefined,
        remaining_principal: undefined,
        interest_rate: undefined,
        interest_type: undefined,
        minimum_payment: undefined,
        next_due_date: undefined,
      });
    }
  }

  const connection = tx.db.connections.id.find(localConnectionId);
  if (connection) {
    tx.db.connections.id.update({ ...connection, updated_at: tx.timestamp, status: "ACTIVE" });
  }

  return {
    accountCount: payload.accounts.length,
    transactionCount,
    holdingCount,
    loanCount,
  };
}

// -----------------------------------------------------------------------------
// LIFECYCLE
// -----------------------------------------------------------------------------

export const init = spacetimedb.init((ctx) => {
  for (const demoUser of DEMO_USERS) {
    const row = {
      id: demoUser.id,
      name: demoUser.name,
      external_customer_id: demoUser.externalId,
    };
    const existing = ctx.db.users.id.find(demoUser.id);
    if (existing) {
      ctx.db.users.id.update({ ...existing, ...row });
    } else {
      ctx.db.users.insert(row);
    }
  }
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called whenever a client connects.
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called whenever a client disconnects.
});

// -----------------------------------------------------------------------------
// REDUCERS
// -----------------------------------------------------------------------------

export const login = spacetimedb.reducer(
  { user_id: t.string() },
  (ctx, { user_id }) => {
    assertUserExists(ctx, user_id);
  },
);

function createConnectionInternal(ctx: any, args: any): void {
  assertUserExists(ctx, args.user_id);

    const existing = ctx.db.connections.id.find(args.connection_id);
    if (existing) {
      if (existing.user_id !== args.user_id) {
        throw new Error("This external connection is already linked to another demo user");
      }
      ctx.db.connections.id.update({
        ...existing,
        institution_id: args.institution_id,
        institution_name: args.institution_name,
        status: "ACTIVE",
        updated_at: ctx.timestamp,
      });
      return;
    }

    const byExternalId = ctx.db.connections.external_connection_id.find(
      args.external_connection_id,
    );
    if (byExternalId) {
      throw new Error("This external connection is already recorded");
    }

    ctx.db.connections.insert({
      id: args.connection_id,
      user_id: args.user_id,
      external_connection_id: args.external_connection_id,
      institution_id: args.institution_id,
      institution_name: args.institution_name,
      status: "ACTIVE",
      connected_at: args.connected_at,
      updated_at: ctx.timestamp,
    });
}

export const createConnection = spacetimedb.reducer(
  {
    connection_id: t.string(),
    user_id: t.string(),
    external_connection_id: t.string(),
    institution_id: t.string(),
    institution_name: t.string(),
    connected_at: t.timestamp(),
  },
  (ctx, args) => createConnectionInternal(ctx, args),
);

function syncAccountInternal(ctx: any, args: any): void {
  const connection = ctx.db.connections.id.find(args.connection_id);

  if (!connection || connection.status !== "ACTIVE") {
    throw new Error("Cannot sync an account for an inactive connection");
  }

  const existing = ctx.db.accounts.external_account_id.find(
    args.external_account_id,
  );

  if (existing && existing.connection_id !== args.connection_id) {
    throw new Error("External account is already linked to another connection");
  }

  const row = {
    id: args.external_account_id,
    connection_id: args.connection_id,
    external_account_id: args.external_account_id,
    name: args.name,
    account_type: args.account_type,
    account_mask: args.account_mask,
    currency: args.currency,
    balance: args.balance,
    updated_at: args.updated_at,
  };

  if (existing) ctx.db.accounts.id.update({ ...existing, ...row });
  else ctx.db.accounts.insert(row);
}

export const syncAccount = spacetimedb.reducer(
  {
    connection_id: t.string(),
    external_account_id: t.string(),
    name: t.string(),
    account_type: t.string(),
    account_mask: t.option(t.string()),
    currency: t.string(),
    balance: t.f64(),
    updated_at: t.timestamp(),
  },
  (ctx, args) => syncAccountInternal(ctx, args),
);

function syncTransactionInternal(ctx: any, args: any): void {
  if (!ctx.db.accounts.id.find(args.account_id)) {
      throw new Error("Cannot sync a transaction for an unknown account");
    }

    const existing = ctx.db.transactions.external_transaction_id.find(
      args.external_transaction_id,
    );
    if (existing && existing.account_id !== args.account_id) {
      throw new Error("External transaction is already linked to another account");
    }

    const row = {
      id: args.external_transaction_id,
      external_transaction_id: args.external_transaction_id,
      account_id: args.account_id,
      description: args.description,
      category: args.category,
      amount: args.amount,
      date: args.date,
    };

    if (existing) ctx.db.transactions.id.update({ ...existing, ...row });
    else ctx.db.transactions.insert(row);
}

export const syncTransaction = spacetimedb.reducer(
  {
    external_transaction_id: t.string(),
    account_id: t.string(),
    description: t.string(),
    category: t.option(t.string()),
    amount: t.f64(),
    date: t.timestamp(),
  },
  (ctx, args) => syncTransactionInternal(ctx, args),
);

function syncHoldingInternal(ctx: any, args: any): void {
  if (!ctx.db.accounts.id.find(args.account_id)) {
      throw new Error("Cannot sync a holding for an unknown account");
    }

    const existing = ctx.db.holdings.external_holding_id.find(args.external_holding_id);
    if (existing && existing.account_id !== args.account_id) {
      throw new Error("External holding is already linked to another account");
    }

    const row = {
      id: args.external_holding_id,
      account_id: args.account_id,
      external_holding_id: args.external_holding_id,
      symbol: args.symbol,
      name: args.name,
      quantity: args.quantity,
      market_value: args.market_value,
      price_per_share: args.price_per_share,
      updated_at: args.updated_at,
    };

    if (existing) ctx.db.holdings.id.update({ ...existing, ...row });
    else ctx.db.holdings.insert(row);
}

export const syncHolding = spacetimedb.reducer(
  {
    external_holding_id: t.string(),
    account_id: t.string(),
    symbol: t.string(),
    name: t.string(),
    quantity: t.f64(),
    market_value: t.f64(),
    price_per_share: t.f64(),
    updated_at: t.timestamp(),
  },
  (ctx, args) => syncHoldingInternal(ctx, args)
);

function syncLoanInternal(ctx: any, args: any) {
  if (!ctx.db.accounts.id.find(args.account_id)) {
      throw new Error("Cannot sync loan details for an unknown account");
    }

    const existing = ctx.db.loan_details.account_id.find(args.account_id);
    if (!args.has_loan) {
      if (existing) ctx.db.loan_details.account_id.delete(args.account_id);
      return;
    }

    if (
      args.original_principal === undefined ||
      args.remaining_principal === undefined ||
      args.interest_rate === undefined ||
      args.interest_type === undefined
    ) {
      throw new Error("Loan data is missing required fields");
    }

    const row = {
      account_id: args.account_id,
      original_principal: args.original_principal,
      remaining_principal: args.remaining_principal,
      amount_owed: args.remaining_principal,
      interest_rate: args.interest_rate,
      interest_type: args.interest_type,
      minimum_payment: args.minimum_payment,
      next_due_date: args.next_due_date,
    };

    if (existing) ctx.db.loan_details.account_id.update(row);
    else ctx.db.loan_details.insert(row);
}

export const syncLoan = spacetimedb.reducer(
  {
    account_id: t.string(),
    has_loan: t.bool(),
    original_principal: t.option(t.f64()),
    remaining_principal: t.option(t.f64()),
    interest_rate: t.option(t.f64()),
    interest_type: t.option(t.string()),
    minimum_payment: t.option(t.f64()),
    next_due_date: t.option(t.timestamp()),
  },
  (ctx, args) => syncLoanInternal(ctx, args),
);

export const updateAsset = spacetimedb.reducer(
  {
    asset_id: t.string(),
    user_id: t.string(),
    name: t.string(),
    asset_type: t.string(),
    estimated_value: t.f64(),
  },
  (ctx, args) => {
    assertUserExists(ctx, args.user_id);
    if (!Number.isFinite(args.estimated_value) || args.estimated_value < 0) {
      throw new Error("Asset value must be a non-negative finite number");
    }

    const existing = ctx.db.assets.id.find(args.asset_id);
    if (existing && existing.user_id !== args.user_id) {
      throw new Error("Asset does not belong to this demo user");
    }

    const row = {
      id: args.asset_id,
      user_id: args.user_id,
      name: args.name,
      asset_type: args.asset_type,
      estimated_value: args.estimated_value,
      updated_at: ctx.timestamp,
    };
    if (existing) ctx.db.assets.id.update(row);
    else ctx.db.assets.insert(row);
  },
);

export const deleteAsset = spacetimedb.reducer(
  { asset_id: t.string(), user_id: t.string() },
  (ctx, { asset_id, user_id }) => {
    assertUserExists(ctx, user_id);
    const asset = ctx.db.assets.id.find(asset_id);
    if (!asset) return;
    if (asset.user_id !== user_id) {
      throw new Error("Asset does not belong to this demo user");
    }
    ctx.db.assets.id.delete(asset_id);
  },
);

// -----------------------------------------------------------------------------
// PROCEDURES: OUTBOUND MOCK FINANCIAL API INTEGRATION
// Procedures return JSON strings to keep the procedure return schema simple.
// The frontend should JSON.parse() each successful result.
// -----------------------------------------------------------------------------

export const getInstitutions = spacetimedb.procedure(t.string(), (ctx) => {
  const result = mockApiRequest(ctx, "/v1/institutions");
  return JSON.stringify(result);
});

export const beginAuthSession = spacetimedb.procedure(
  {
    user_id: t.string(),
    institution_id: t.string(),
  },
  t.string(),
  (ctx, { user_id, institution_id }) => {
    const user = ctx.withTx((tx: any) => assertUserExists(tx, user_id));
    const result = mockApiRequest(ctx, "/v1/auth/sessions", "POST", {
      app_user_id: user.id,
      customer_id: user.external_customer_id,
      institution_id,
    });
    return JSON.stringify(result);
  },
);

export const connectInstitution = spacetimedb.procedure(
  {
    user_id: t.string(),
    institution_id: t.string(),
    institution_name: t.string(),
    session_id: t.string(),
    authorization_token: t.string(),
    account_ids: t.array(t.string()),
  },
  t.string(),
  (ctx, args) => {
    const user = ctx.withTx((tx: any) => assertUserExists(tx, args.user_id));
    if (args.account_ids.length === 0) {
      throw new Error("Select at least one account to connect");
    }
    if (new Set(args.account_ids).size !== args.account_ids.length) {
      throw new Error("The account selection contains duplicate IDs");
    }

    const connectionResult = mockApiRequest(ctx, "/v1/connections", "POST", {
      session_id: args.session_id,
      authorization_token: args.authorization_token,
      account_ids: args.account_ids,
    });
    const providerConnection = connectionResult?.connection;
    const externalConnectionId = requiredString(providerConnection?.id, "connection.id");

    // Use the provider's connection UUID as the local primary key too. This
    // gives the app a stable one-to-one mapping and makes webhook lookup easy.
    ctx.withTx((tx: any) => {
      createConnectionInternal(tx, {
        connection_id: externalConnectionId,
        user_id: user.id,
        external_connection_id: externalConnectionId,
        institution_id: args.institution_id,
        institution_name: args.institution_name,
        connected_at: timestamp(providerConnection.created_at, tx.timestamp),
      });
    });

    // The provider-side connection now exists and is recorded locally. If the
    // first data fetch fails, the frontend still receives its connection ID
    // and can retry with syncConnection().
    try {
      const financialData = mockApiRequest(
        ctx,
        `/v1/connections/${encodeURIComponent(externalConnectionId)}/data`,
      );
      const counts = ctx.withTx((tx: any) =>
        saveConnectionData(tx, user.id, externalConnectionId, financialData),
      );
      return JSON.stringify({
        status: "connected_and_synced",
        connection_id: externalConnectionId,
        institution_id: args.institution_id,
        institution_name: args.institution_name,
        ...counts,
      });
    } catch (error) {
      return JSON.stringify({
        status: "connected_sync_failed",
        connection_id: externalConnectionId,
        error: errorMessage(error),
      });
    }
  },
);

export const syncConnection = spacetimedb.procedure(
  { user_id: t.string(), connection_id: t.string() },
  t.string(),
  (ctx, { user_id, connection_id }) => {
    const connection = ctx.withTx((tx: any) => {
      assertUserExists(tx, user_id);
      const row = tx.db.connections.id.find(connection_id);
      if (!row || row.user_id !== user_id) {
        throw new Error("Connection was not found for this demo user");
      }
      if (row.status === "DISCONNECTED") {
        throw new Error("This connection is disconnected");
      }
      return row;
    });

    const financialData = mockApiRequest(
      ctx,
      `/v1/connections/${encodeURIComponent(connection.external_connection_id)}/data`,
    );
    const counts = ctx.withTx((tx: any) =>
      saveConnectionData(tx, user_id, connection_id, financialData),
    );

    return JSON.stringify({
      status: "synced",
      connection_id,
      ...counts,
    });
  },
);

/**
 * The provided Mock API currently has no disconnect endpoint. This procedure
 * therefore disconnects the connection in the Fin360 app only. Add a provider
 * route if you also want to revoke the provider-side connection.
 */
export const disconnectConnection = spacetimedb.procedure(
  { user_id: t.string(), connection_id: t.string() },
  t.string(),
  (ctx, { user_id, connection_id }) => {
    ctx.withTx((tx: any) => {
      assertUserExists(tx, user_id);
      const connection = tx.db.connections.id.find(connection_id);
      if (!connection || connection.user_id !== user_id) {
        throw new Error("Connection was not found for this demo user");
      }
      tx.db.connections.id.update({
        ...connection,
        status: "DISCONNECTED",
        updated_at: tx.timestamp,
      });
    });
    return JSON.stringify({
      status: "disconnected_locally",
      connection_id,
      provider_revoked: false,
    });
  },
);

export const registerWebhook = spacetimedb.procedure(
  { user_id: t.string(), callback_url: t.string() },
  t.string(),
  (ctx, { user_id, callback_url }) => {
    const user = ctx.withTx((tx: any) => assertUserExists(tx, user_id));
    const result = mockApiRequest(ctx, "/v1/webhooks", "POST", {
      app_user_id: user.id,
      callback_url,
    });
    return JSON.stringify(result);
  },
);

// -----------------------------------------------------------------------------
// HTTP HANDLER: INCOMING MOCK API WEBHOOKS
//
// The Mock API must include `transaction` and `updated_account` in each
// transaction.created event. See the sender change below the main code.
// HTTP handlers are synchronous, so they do not make outbound API requests.
// -----------------------------------------------------------------------------

export const transactionWebhook = spacetimedb.httpHandler((ctx, request) => {
  const suppliedSecret = request.headers.get("x-mock-webhook-secret");
  if (!suppliedSecret || suppliedSecret !== ctx.env.MOCK_WEBHOOK_SECRET) {
    return new SyncResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(request.text());
  } catch {
    return new SyncResponse(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    if (event?.event_type !== "transaction.created") {
      return new SyncResponse(JSON.stringify({ error: "Unsupported event type" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const eventId = requiredString(event.event_id, "event_id");
    const externalConnectionId = requiredString(event.connection_id, "connection_id");
    const externalAccountId = requiredString(event.account_id, "account_id");
    const providerTransaction = event.transaction;
    const providerAccount = event.updated_account;

    if (
      !providerTransaction ||
      !providerAccount ||
      String(providerTransaction.id) !== String(event.resource_id) ||
      String(providerTransaction.account_id) !== externalAccountId ||
      String(providerAccount.id) !== externalAccountId
    ) {
      throw new Error("Webhook is missing consistent transaction/account details");
    }

    const result = ctx.withTx((tx: any) => {
      if (tx.db.webhook_events.event_id.find(eventId)) {
        return "duplicate";
      }

      const connection = tx.db.connections.external_connection_id.find(
        externalConnectionId,
      );
      if (!connection || connection.status !== "ACTIVE") {
        throw new Error("Webhook references an unknown or inactive connection");
      }

      const localAccount = tx.db.accounts.external_account_id.find(externalAccountId);
      if (!localAccount || localAccount.connection_id !== connection.id) {
        throw new Error("Webhook account is not linked to the specified connection");
      }

      syncAccountInternal(tx, {
        connection_id: connection.id,
        external_account_id: externalAccountId,
        name: requiredString(providerAccount.name, "account.name"),
        account_type: requiredString(providerAccount.account_type, "account.account_type"),
        account_mask: optionalString(providerAccount.account_mask),
        currency: optionalString(providerAccount.currency) ?? "USD",
        balance: numeric(providerAccount.balance, "account.balance"),
        updated_at: timestamp(providerAccount.updated_at, tx.timestamp),
      });

      syncTransactionInternal(tx, {
        external_transaction_id: requiredString(providerTransaction.id, "transaction.id"),
        account_id: externalAccountId,
        description: requiredString(providerTransaction.description, "transaction.description"),
        category: optionalString(providerTransaction.category),
        amount: numeric(providerTransaction.amount, "transaction.amount"),
        date: timestamp(providerTransaction.transaction_date, tx.timestamp),
      });

      tx.db.webhook_events.insert({
        event_id: eventId,
        connection_id: externalConnectionId,
        account_id: externalAccountId,
        received_at: tx.timestamp,
      });
      return "processed";
    });

    return new SyncResponse(
      JSON.stringify({ status: result }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    return new SyncResponse(
      JSON.stringify({ error: errorMessage(error) }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }
});

export const router = spacetimedb.httpRouter(
  new Router().post("/webhooks/transactions", transactionWebhook),
);
