# Mock Financial API

Mock server that stands in for real financial servers with REST APIs that our website would connect to to get user account information for a variety of institutions.

It simulates authorization sessions (which in reality would call provider APIs for authentication), connecting to a provider's accounts for the given user, and retreiving the data from said connected accounts.

It also provides an API to allow a client to subscribe to webhooks, and an API to simulate a transaction being made that would send a webhook to the client on update. Authentication is done via user ID, which is printed during database seeding.

## Setup

### Environment variables

Copy `.env.example` into `.env`. It would be good practice to generate a random mock API key and webhook secret, but it doesn't matter too much for local development. _Put the `MOCK_API_KEY` in the client's `.env` too._

### Database

You can create a Postgresql server however you want; you may use [Homebrew](https://wiki.postgresql.org/wiki/Homebrew) as well, but it didn't work for me so these instructions will describe how to use [Postgres.app](https://postgresapp.com/) instead.

Steps

1. Follow instructions on the [Downloads page](https://postgresapp.com/) to download Postgres.app
2. Check if you have `psql` and `createdb` installed already with `which psql; which createdb`.

- If either is not already installed, run the following to add the CLI tools installed with Postgres.app to your PATH:

```bash
sudo mkdir -p /etc/paths.d
echo /Applications/Postgres.app/Contents/Versions/latest/bin sudo tee /etc/paths.d/postgresapp
```

3. _(start here if alr have Postgres App & commands)_ Open Postgres app and click **Initialize** to start a Postgres server.
4. Create a database with `createdb mock_financial_api`
5. Now, apply the database schema and seed the database:

```zsh
psql mock_financial_api -f src/db/schema.sql
npm run seed
```

> [!NOTE]  
> **Hold onto the printed user IDs; you need them for authentication in client.**

## How to use (see REFERENCE.md for more precise documentation)

1. **Get available institutions**
   - Call `GET /v1/institutions`.
   - Let the user select an institution.

2. **Initiate authorization**
   - Call `POST /v1/auth/sessions` with `app_user_id`, `customer_id`, and `institution_id`.
   - Store the returned `session_id` and `authorization_token`.
   - The response includes the institution's available accounts.

3. **Connect accounts**
   - Let the user select which accounts to connect.
   - Call `POST /v1/connections` with the `session_id`, `authorization_token`, and selected `account_ids`.
   - Must be completed within **10 minutes** of initiating authorization.
   - Store the returned connection ID.

4. **Retrieve financial data**
   - Call `GET /v1/connections/:id/data` using the stored connection ID.
   - Returns connected accounts, transactions, investment holdings, and loan information.

5. **Keep data updated**
   - Subscribe to webhooks using `POST /v1/webhooks`.
   - Your application receives notifications when new transactions are simulated.

## File structure

```bash
mock-financial-api/
├── src/
│   ├── db/ # database driver, initialization, and seeding
│   ├── webhooks.js # function to send POST request with webhook data
│   └── server.js # Express server
├── .env
├── .gitignore
└── package.json
```

## AI Disclosure

ChatGPT was used to generate and debug the code for this mock API.
