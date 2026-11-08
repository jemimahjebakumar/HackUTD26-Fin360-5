# Mock Financial API

Mock server that stands in for real financial servers with REST APIs that our website would connect to to get user account information. It's just an Express server that wraps a Postgre database with a REST API.

## Setup

### Environment variables

Copy `.env.example` into `.env`, and generate an API key and webhook secret with `openssl rand -hex 32`.

### Database

We're using Postgresql v17. Install the database server with your system's package manager.

For MacOS, you can use Homebrew:

```zsh
brew install postgresql@17
```

To get a PostgreSQL database server instance running and create a database in it, do:

```zsh
brew services start postgresql@17 # start postgre server
createdb mock_financial_api # connect to server and create a database called mock_financial_api
```

Now, apply the database schema and seed the database:

```zsh
psql mock_financial_api -f src/db/schema.sql
npm run seed
```

## File structure

```bash
mock-financial-api/
├── src/
│   ├── db/
│   │   ├── pool.js
│   │   ├── schema.sql
│   │   └── seed.js
│   ├── routes/
│   │   ├── institutions.js
│   │   ├── authorization.js
│   │   ├── connections.js
│   │   ├── accounts.js
│   │   ├── transactions.js
│   │   └── simulation.js
│   ├── middleware/
│   │   └── authenticate.js
│   ├── services/
│   │   └── webhooks.js
│   └── server.js
├── .env
├── .gitignore
└── package.json
```

## AI Disclosure

ChatGPT was used to generate the template for this mock API.
