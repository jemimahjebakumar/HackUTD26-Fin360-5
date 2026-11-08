# Mock Financial API

Base URL: `http://localhost:4000`

All `/v1` endpoints require the following header:

```http
x-api-key: MOCK_API_KEY
```

Requests with JSON bodies must include:

```http
Content-Type: application/json
```

Clients should generate a random app user ID that they can pass to these API calls to identify themselves.

## Endpoints

1. [Health Check](#1-health-check)
2. [Get Institutions](#2-get-institutions)
3. [Create Authorization Session](#3-create-authorization-session)
4. [Create Connection](#4-create-connection)
5. [Retrieve Connection Data](#5-retrieve-connection-data)
6. [Subscribe to Webhooks](#6-subscribe-to-webhooks)
7. [Simulate Transaction Update](#7-simulate-transaction-update)

[Webhook event formats](#webhook-events)
[Error responses](#error-responses)

### 1. Health Check

`GET /health`

Checks whether the server is running. No authentication required.

**Response `200`:**

```json
{
  "status": "ok"
}
```

### 2. Get Institutions

`GET /v1/institutions`

Returns all available financial institutions.

**Response `200`:**

```json
{
  "institutions": [
    {
      "id": "uuid",
      "name": "Chase",
      "institution_type": "BANK"
    }
  ]
}
```

### 3. Create Authorization Session

`POST /v1/auth/sessions`

Initiates a simulated authorization session for an institution. Sessions expire after 10 minutes.

**Request:**

```json
{
  "app_user_id": "uuid",
  "customer_id": "uuid",
  "institution_id": "uuid"
}
```

**Response `200`:**

```json
{
  "session_id": "uuid",
  "authorization_token": "token",
  "expires_at": "timestamp",
  "institution": {},
  "available_accounts": [
    {
      "id": "uuid",
      "name": "Checking",
      "account_type": "CHECKING",
      "account_mask": "1234",
      "balance": 1500.0,
      "currency": "USD"
    }
  ]
}
```

Returns all accounts belonging to the specified customer at the selected institution.

### 4. Create Connection

`POST /v1/connections`

Completes authorization and connects the selected accounts. Each authorization session can only be used once.

**Request:**

```json
{
  "session_id": "uuid",
  "authorization_token": "token",
  "account_ids": ["uuid", "uuid"]
}
```

**Response `201`:**

```json
{
  "connection": {
    "id": "uuid",
    "app_user_id": "uuid",
    "customer_id": "uuid",
    "institution_id": "uuid"
  },
  "connected_account_ids": ["uuid", "uuid"]
}
```

All selected accounts must belong to the customer and institution associated with the authorization session.

### 5. Retrieve Connection Data

`GET /v1/connections/:id/data`

Retrieves financial data for all accounts associated with an active connection.

**Response `200`:**

```json
{
  "connection": {},
  "accounts": [
    {
      "id": "uuid",
      "name": "Checking",
      "account_type": "CHECKING",
      "balance": 1500.0,
      "currency": "USD",
      "transactions": [],
      "holdings": [],
      "loan": null
    }
  ]
}
```

Each account includes:

- `transactions`: Transactions ordered by date (newest first).
- `holdings`: Investment holdings, if any.
- `loan`: Loan details, or `null` if not applicable.

### 6. Subscribe to Webhooks

`POST /v1/webhooks`

Registers a callback URL to receive financial data update notifications for an application user.

**Request:**

```json
{
  "app_user_id": "uuid",
  "callback_url": "https://example.com/webhooks"
}
```

**Response `201`:**

```json
{
  "subscription": {
    "id": "uuid",
    "app_user_id": "uuid",
    "callback_url": "https://example.com/webhooks"
  }
}
```

### 7. Simulate Transaction Update

`POST /v1/simulate/transactions`

Simulates a new transaction from a financial institution. Updates the account balance, creates a transaction, and sends webhook notifications to connected application users.

**Request:**

```json
{
  "account_id": "uuid",
  "description": "Grocery Store",
  "category": "Groceries",
  "amount": -45.5
}
```

`category` is optional. Positive amounts represent credits; negative amounts represent debits.

**Response `201`:**

```json
{
  "transaction": {},
  "updated_account": {}
}
```

## Webhook Events

When a transaction is created, subscribed users receive a POST request at their registered `callback_url`.

**Event: `transaction.created`**

```json
{
  "event_id": "uuid",
  "event_type": "transaction.created",
  "created_at": "timestamp",
  "connection_id": "uuid",
  "account_id": "uuid",
  "resource_id": "uuid"
}
```

- `event_id`: Unique event identifier.
- `event_type`: Event name.
- `created_at`: Event timestamp (ISO 8601).
- `connection_id`: Affected connection.
- `account_id`: Affected account.
- `resource_id`: ID of the newly created transaction.

## Error Responses

All errors return JSON in the following format:

```json
{
  "error": "Error description"
}
```

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| `400`  | Invalid or missing request fields             |
| `401`  | Invalid API key or authorization session      |
| `404`  | Institution, account, or connection not found |
| `500`  | Internal server error                         |
