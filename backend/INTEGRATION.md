# Fin360 Frontend ↔ SpacetimeDB Integration

This guide explains how the React frontend calls the Fin360 SpacetimeDB module and subscribes to financial data.

The frontend talks to **SpacetimeDB only**. SpacetimeDB procedures call the Mock Financial API; reducers update SpacetimeDB tables; subscriptions deliver table changes to React.

```text
React frontend
    │
    ├── procedures / reducers ──► SpacetimeDB module
    │                                  │
    │                                  └── HTTP requests ──► Mock Financial API
    │
    └── table subscriptions ◄──── SpacetimeDB tables

Mock Financial API ── webhook POST ──► SpacetimeDB HTTP handler
```

## 1. Generate the frontend bindings

The frontend must use generated bindings from the SpacetimeDB module. Generate them after changing `backend/spacetimedb/src/index.ts`:

```bash
# Run from the repository root.
mkdir -p frontend/src/module_bindings
spacetime generate \
  --lang typescript \
  --out-dir frontend/src/module_bindings \
  --module-path backend/spacetimedb
```

If your module directory is not `backend/spacetimedb`, change `--module-path` to the directory containing its `package.json`.

Install the client SDK in the frontend project:

```bash
cd frontend
npm install spacetimedb
```

Regenerate bindings whenever you change the module's tables, reducers, or procedures. The generated binding names use TypeScript camelCase, even when the module's schema fields use `snake_case` (for example, `user_id` becomes `userId`).

## 2. Configure the connection

For a local SpacetimeDB instance started by the module's development script, the connection settings are:

- URI: `ws://127.0.0.1:5001`
- Database: `fin360-dev`

For a Vite frontend, add these to `frontend/.env.local`:

```dotenv
VITE_SPACETIMEDB_URI=ws://127.0.0.1:5001
VITE_SPACETIMEDB_DATABASE=fin360-dev
```

These are public connection settings, not secrets. Do **not** put `MOCK_API_KEY` or `MOCK_WEBHOOK_SECRET` in the frontend environment. Those belong in the SpacetimeDB module's server-side environment.

## 3. Wrap the React app in the SpacetimeDB provider

Create `frontend/src/SpacetimeDBProvider.tsx`:

```tsx
import { SpacetimeDBProvider as Provider } from "spacetimedb/react";
import { DbConnection } from "./module_bindings";

const connectionBuilder = DbConnection.builder()
  .withUri(
    import.meta.env.VITE_SPACETIMEDB_URI ?? "ws://127.0.0.1:5001",
  )
  .withDatabaseName(
    import.meta.env.VITE_SPACETIMEDB_DATABASE ?? "fin360-dev",
  )
  .onConnect((conn, identity) => {
    console.info("Connected to SpacetimeDB:", identity.toHexString());
  })
  .onDisconnect(() => {
    console.warn("Disconnected from SpacetimeDB");
  });

export function AppSpacetimeDBProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider connectionBuilder={connectionBuilder}>
      {children}
    </Provider>
  );
}
```

Wrap the application once in `frontend/src/main.tsx` (or the equivalent application entry point):

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppSpacetimeDBProvider } from "./SpacetimeDBProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppSpacetimeDBProvider>
      <App />
    </AppSpacetimeDBProvider>
  </React.StrictMode>,
);
```

For Next.js, put the provider in a Client Component (`"use client"`) and wrap the relevant application subtree with it. The `import.meta.env` expressions above are Vite-specific; use your framework's public environment-variable syntax if you use a different build system.

The React `useTable` hook manages its own subscriptions, so you do not need to manually subscribe to those tables in the provider's `onConnect` callback.

## 4. Calling procedures and reducers

In React components, get the current generated connection with `useSpacetimeDB`. Procedure results from this module are JSON **strings**, so parse them after awaiting the procedure call.

```tsx
import { useSpacetimeDB } from "spacetimedb/react";
import { DbConnection } from "./module_bindings";

export function Example() {
  const { isActive, getConnection } = useSpacetimeDB<DbConnection>();

  async function exampleCall() {
    const conn = getConnection();
    if (!isActive || !conn) {
      throw new Error("SpacetimeDB is not connected");
    }

    // Procedures return JSON strings in this module.
    const rawJson = await conn.procedures.getInstitutions();
    const institutions: unknown = JSON.parse(rawJson);
    console.log(institutions);
  }

  return (
    <button disabled={!isActive} onClick={() => void exampleCall()}>
      Load institutions
    </button>
  );
}
```

A small helper can avoid repeating `JSON.parse`:

```ts
export async function callJsonProcedure<T>(
  request: Promise<string>,
): Promise<T> {
  const json = await request;
  return JSON.parse(json) as T;
}
```

Wrap procedure and reducer calls in `try/catch`; rejected promises indicate that the operation failed.

### Demo login

The `login` reducer only verifies that a demo user exists. Keep the selected demo user in React state:

```tsx
const conn = getConnection();
if (!conn) throw new Error("SpacetimeDB is not connected");

await conn.reducers.login({ userId: "alex" });
setActiveUserId("alex");
```

Valid demo IDs are `alex`, `jordan`, and `taylor`. In this demo, selecting a user is not real authentication and does not establish a server-side user session.

### Available procedures

All names below are called from `conn.procedures` using camelCase arguments.

| Procedure | Arguments | Result |
|---|---|---|
| `getInstitutions()` | None | JSON string containing the Mock API's institution response |
| `beginAuthSession({ userId, institutionId })` | Selected demo user and institution | JSON string containing `session_id`, `authorization_token`, `expires_at`, `institution`, and `available_accounts` |
| `connectInstitution({ userId, institutionId, institutionName, sessionId, authorizationToken, accountIds })` | Selected accounts from the authorization response | JSON string with connection status, `connection_id`, and sync counts or an error |
| `syncConnection({ userId, connectionId })` | User and existing connection | JSON string with sync status and counts |
| `disconnectConnection({ userId, connectionId })` | User and existing connection | JSON string confirming local disconnection |
| `registerWebhook({ userId, callbackUrl })` | User and public HTTP callback URL | JSON string containing the Mock API's subscription response |

### Example: institution connection flow

The Mock API authorization response uses snake_case property names because these properties are inside JSON returned as a string; code generation does not rename those JSON keys.

```tsx
import { useSpacetimeDB } from "spacetimedb/react";
import { DbConnection } from "./module_bindings";

 type AuthSession = {
  session_id: string;
  authorization_token: string;
  expires_at: string;
  institution: { id: string; name: string };
  available_accounts: Array<{
    id: string;
    name: string;
    account_type: string;
    account_mask: string | null;
    balance: number | string;
    currency: string;
  }>;
};

type ConnectResult =
  | {
      status: "connected_and_synced";
      connection_id: string;
      accountCount: number;
      transactionCount: number;
      holdingCount: number;
      loanCount: number;
    }
  | {
      status: "connected_sync_failed";
      connection_id: string;
      error: string;
    };

export function ConnectInstitutionExample() {
  const { isActive, getConnection } = useSpacetimeDB<DbConnection>();

  async function connectSelectedAccounts() {
    const conn = getConnection();
    if (!isActive || !conn) throw new Error("SpacetimeDB is not connected");

    const userId = "alex";
    const institutionId = "REPLACE_WITH_INSTITUTION_ID";

    // 1. Ask the provider for a temporary authorization session.
    const authJson = await conn.procedures.beginAuthSession({
      userId,
      institutionId,
    });
    const auth = JSON.parse(authJson) as AuthSession;

    // 2. Display auth.available_accounts in your UI and let the user choose.
    // This example selects all accounts; replace it with the actual selection.
    const selectedAccountIds = auth.available_accounts.map((account) => account.id);

    // 3. Create the provider connection and import its financial data.
    const connectJson = await conn.procedures.connectInstitution({
      userId,
      institutionId,
      institutionName: auth.institution.name,
      sessionId: auth.session_id,
      authorizationToken: auth.authorization_token,
      accountIds: selectedAccountIds,
    });
    const result = JSON.parse(connectJson) as ConnectResult;

    if (result.status === "connected_sync_failed") {
      // The provider connection was created and recorded locally, but its
      // first data import failed. Keep the ID and offer a sync retry.
      console.error("Connected, but initial sync failed:", result.error);
      return;
    }

    console.log("Connected and synchronized:", result);
  }

  return (
    <button disabled={!isActive} onClick={() => void connectSelectedAccounts()}>
      Connect institution
    </button>
  );
}
```

In a real UI, show the account list from `available_accounts` and let the user select accounts before calling `connectInstitution`. The authorization token is temporary; keep it in component state only for the duration of the connection flow and do not persist it in local storage.

### Sync or disconnect an existing connection

```ts
const conn = getConnection();
if (!conn) throw new Error("SpacetimeDB is not connected");

const syncJson = await conn.procedures.syncConnection({
  userId: activeUserId,
  connectionId,
});
const syncResult = JSON.parse(syncJson);

const disconnectJson = await conn.procedures.disconnectConnection({
  userId: activeUserId,
  connectionId,
});
const disconnectResult = JSON.parse(disconnectJson);
```

**Disconnect is local only in the current module.** The Mock Financial API does not currently expose a provider-side disconnect endpoint, so this does not revoke the provider's connection.

### Register the webhook

For the local configuration above, the handler URL is:

```text
http://127.0.0.1:5001/v1/database/fin360-dev/route/webhooks/transactions
```

Register it with the procedure (normally once per demo user, not on every component render):

```ts
const callbackUrl =
  "http://127.0.0.1:5001/v1/database/fin360-dev/route/webhooks/transactions";

const registrationJson = await conn.procedures.registerWebhook({
  userId: activeUserId,
  callbackUrl,
});
const registration = JSON.parse(registrationJson);
```

The Mock Financial API must be able to reach this URL. `127.0.0.1` works only when the API and SpacetimeDB are running in an environment where that address resolves to the same machine/container. For a remote API or separate containers, use a reachable host address or a secure tunnel during development.

The HTTP handler expects the `X-Mock-Webhook-Secret` header and verifies it against the SpacetimeDB `MOCK_WEBHOOK_SECRET`. The Mock API's `notifyUser()` must send that header using its server-side `WEBHOOK_SECRET`. The event body must include `event_id`, `event_type`, `connection_id`, `account_id`, `resource_id`, `transaction`, and `updated_account`.

The browser does not call the webhook handler directly. The Mock API sends the webhook; SpacetimeDB updates its tables; React subscriptions receive the changes.

## 5. Subscribing to financial data

Use `useTable` from `spacetimedb/react`. These subscriptions update React components when rows change, including changes caused by a webhook.

Example: show accounts belonging to one connection:

```tsx
import { useTable } from "spacetimedb/react";
import { tables } from "./module_bindings";

export function AccountList({ connectionId }: { connectionId: string }) {
  const [accounts, isReady] = useTable(
    tables.accounts.where((row) => row.connectionId.eq(connectionId)),
  );

  if (!isReady) return <p>Loading accounts…</p>;

  return (
    <ul>
      {accounts.map((account) => (
        <li key={account.id}>
          {account.name}: {account.currency} {account.balance.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
```

Other available public tables:

```tsx
const [connections, connectionsReady] = useTable(
  tables.connections.where((row) => row.userId.eq(userId)),
);

const [transactions, transactionsReady] = useTable(
  tables.transactions.where((row) => row.accountId.eq(accountId)),
);

const [holdings, holdingsReady] = useTable(
  tables.holdings.where((row) => row.accountId.eq(accountId)),
);

const [loanDetails, loansReady] = useTable(
  tables.loanDetails.where((row) => row.accountId.eq(accountId)),
);

const [assets, assetsReady] = useTable(
  tables.assets.where((row) => row.userId.eq(userId)),
);
```

The corresponding generated table accessors are `tables.connections`, `tables.accounts`, `tables.transactions`, `tables.holdings`, `tables.loanDetails`, and `tables.assets`. The `users` and `webhook_events` tables are private in the current module and are not available to ordinary client subscriptions.

The date columns are SpacetimeDB `Timestamp` values. Use the SDK timestamp methods or convert them through the SDK's supported date conversion rather than assuming they are plain ISO strings.

## 6. User-tracked assets

The app can add/update or delete user-tracked assets with reducers:

```ts
const conn = getConnection();
if (!conn) throw new Error("SpacetimeDB is not connected");

await conn.reducers.updateAsset({
  assetId: crypto.randomUUID(), // Reuse an existing ID when editing.
  userId: activeUserId,
  name: "2019 Honda Civic",
  assetType: "VEHICLE",
  estimatedValue: 14500,
});

await conn.reducers.deleteAsset({
  assetId,
  userId: activeUserId,
});
```

`updateAsset` rejects negative or non-finite values and checks that an existing asset belongs to the supplied demo user. The caller should reuse the asset's existing `assetId` when editing; generate a new UUID only when creating a new asset.

## 7. Important development and security notes

- **Demo login is not authentication.** `login` only checks that `alex`, `jordan`, or `taylor` exists. It does not bind the caller's SpacetimeDB identity to that user.
- **The financial tables are public in the current module.** Every client can subscribe to every row in `connections`, `accounts`, `transactions`, `holdings`, `loan_details`, and `assets`. A filtered `useTable` query is for convenience, not an authorization boundary. Do not use real financial data with this schema.
- **Keep secrets server-side.** Never put the Mock API key or webhook secret in Vite/Next public environment variables or browser code.
- **The procedures return JSON strings.** `JSON.parse` is required for `getInstitutions`, `beginAuthSession`, `connectInstitution`, `syncConnection`, `disconnectConnection`, and `registerWebhook`.
- **Do not call the sync reducers directly from UI code.** `createConnection`, `syncAccount`, `syncTransaction`, `syncHolding`, and `syncLoan` are intended for the server-side synchronization workflow. Use the procedures above instead.
- **Verify the module builds before wiring the frontend.** In the provided `index.ts`, the procedure/helper code calls the exported reducer definitions (`createConnection`, `syncAccount`, `syncTransaction`, `syncHolding`, and `syncLoan`) as though they were ordinary helper functions. Reducer definitions are not local database-mutation helpers. Extract the mutation bodies into regular helper functions and have both reducers and procedures call those helpers within their transactions. Then run `npm run build` and regenerate bindings.

## 8. Typical end-to-end flow

1. Start the local SpacetimeDB server/module and the Mock Financial API.
2. Connect React to the `fin360-dev` database.
3. Call `login({ userId })` and store the selected demo user ID in frontend state.
4. Call `getInstitutions()` and let the user select an institution.
5. Call `beginAuthSession({ userId, institutionId })`.
6. Display the available accounts and let the user select accounts.
7. Call `connectInstitution(...)` with the temporary authorization details and selected account IDs.
8. Render the synchronized data through `useTable` subscriptions.
9. Register the webhook callback once. Later provider transaction events are written to SpacetimeDB and appear through the same subscriptions.
10. Call `syncConnection(...)` when the user requests a manual refresh.

## References

- [SpacetimeDB TypeScript client reference](https://spacetimedb.com/docs/clients/typescript/)
- [Generating client bindings](https://spacetimedb.com/docs/clients/codegen/)
- [HTTP handlers and route URLs](https://spacetimedb.com/docs/functions/http-handlers/)
