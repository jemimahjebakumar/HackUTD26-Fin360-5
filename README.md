# HackUTD26-Fin360-5

Fin360+5 is an AI-powered financial navigator that helps users understand their financial health, explore future financial decisions, and connect with PNC advisors for personalized guidance.

## Setup

Start a Postgres server (see [`mock-financial-api/README.md`](./mock-financial-api/README.md) for details). Ensure `psql` and `createdb` commands are available with `which psql; which createdb`. Then,

```bash
npm run install:all
npm run setup
npm run dev
```

Then navigate to `localhost:3000` in your favorite web browser.

## File structure

```bash
.
├── frontend
├── backend
└── mock-financial-api
```
