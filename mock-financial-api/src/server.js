import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import "dotenv/config";

import { pool } from "./db/pool.js";
import { notifyUser } from "./webhooks.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// authenticate by checking header x-api-key is the mock key

function authenticate(req, res, next) {
  const key = req.headers["x-api-key"];

  if (key !== process.env.MOCK_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
}

app.use("/v1", authenticate);

// HEALTH (check if server is running)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// get all institutions this API has
app.get("/v1/institutions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, institution_type
      FROM institutions
      ORDER BY name
    `);

    res.json({
      institutions: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// simulate an authorized session for a given institution
// in reality, behavior would be different for each given institution
app.post("/v1/auth/sessions", async (req, res) => {
  const { app_user_id, customer_id, institution_id } = req.body;

  if (!app_user_id || !customer_id || !institution_id) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  try {
    // Verify institution and customer
    const institution = await pool.query(
      `SELECT * FROM institutions WHERE id = $1`,
      [institution_id],
    );

    if (!institution.rowCount) {
      return res.status(404).json({
        error: "Institution not found",
      });
    }

    // Find available accounts
    const accounts = await pool.query(
      `SELECT id, name, account_type, account_mask,
              balance, currency
       FROM accounts
       WHERE customer_id = $1
         AND institution_id = $2`,
      [customer_id, institution_id],
    );

    // Generate temporary authorization token
    const token = crypto.randomBytes(32).toString("hex");

    const session = await pool.query(
      `INSERT INTO auth_sessions
        (app_user_id, customer_id, institution_id,
         authorization_token, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')
       RETURNING id, expires_at`,
      [app_user_id, customer_id, institution_id, token],
    );

    res.json({
      session_id: session.rows[0].id,
      authorization_token: token,
      expires_at: session.rows[0].expires_at,

      institution: institution.rows[0],

      available_accounts: accounts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// start a database connection with the givenn authorization token
app.post("/v1/connections", async (req, res) => {
  const { session_id, authorization_token, account_ids } = req.body;

  if (
    !session_id ||
    !authorization_token ||
    !Array.isArray(account_ids) ||
    account_ids.length === 0
  ) {
    return res.status(400).json({
      error: "Invalid connection request",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate authorization session
    const sessionResult = await client.query(
      `SELECT * FROM auth_sessions
       WHERE id = $1
         AND authorization_token = $2
         AND used = FALSE
         AND expires_at > NOW()
       FOR UPDATE`,
      [session_id, authorization_token],
    );

    if (!sessionResult.rowCount) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        error: "Invalid or expired authorization session",
      });
    }

    const session = sessionResult.rows[0];

    // Verify that all selected accounts belong
    // to this customer and institution.
    const accounts = await client.query(
      `SELECT id FROM accounts
       WHERE id = ANY($1::uuid[])
         AND customer_id = $2
         AND institution_id = $3`,
      [account_ids, session.customer_id, session.institution_id],
    );

    if (accounts.rowCount !== new Set(account_ids).size) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Invalid account selection",
      });
    }

    // Create connection
    const connection = await client.query(
      `INSERT INTO connections
        (app_user_id, customer_id, institution_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [session.app_user_id, session.customer_id, session.institution_id],
    );

    const connectionId = connection.rows[0].id;

    // Associate selected accounts with connection
    for (const accountId of account_ids) {
      await client.query(
        `INSERT INTO connection_accounts
          (connection_id, account_id)
         VALUES ($1, $2)`,
        [connectionId, accountId],
      );
    }

    // Prevent session reuse
    await client.query(
      `UPDATE auth_sessions
       SET used = TRUE
       WHERE id = $1`,
      [session_id],
    );

    await client.query("COMMIT");

    res.status(201).json({
      connection: connection.rows[0],
      connected_account_ids: account_ids,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// retrieve all of a user's financial data for a given institution
app.get("/v1/connections/:id/data", async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await pool.query(
      `SELECT * FROM connections
       WHERE id = $1 AND status = 'ACTIVE'`,
      [id],
    );

    if (!connection.rowCount) {
      return res.status(404).json({
        error: "Connection not found",
      });
    }

    const accountResult = await pool.query(
      `SELECT a.*
       FROM accounts a
       JOIN connection_accounts ca
         ON ca.account_id = a.id
       WHERE ca.connection_id = $1`,
      [id],
    );

    const accounts = [];

    for (const account of accountResult.rows) {
      // Retrieve transactions
      const transactions = await pool.query(
        `SELECT * FROM transactions
         WHERE account_id = $1
         ORDER BY transaction_date DESC`,
        [account.id],
      );

      // Retrieve investment holdings
      const holdings = await pool.query(
        `SELECT * FROM investment_holdings
         WHERE account_id = $1`,
        [account.id],
      );

      // Retrieve loan information
      const loan = await pool.query(
        `SELECT * FROM loans
         WHERE account_id = $1`,
        [account.id],
      );

      accounts.push({
        ...account,
        transactions: transactions.rows,
        holdings: holdings.rows,
        loan: loan.rows[0] ?? null,
      });
    }

    res.json({
      connection: connection.rows[0],
      accounts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// subscribe to webhooks
app.post("/v1/webhooks", async (req, res) => {
  const { app_user_id, callback_url } = req.body;

  if (!app_user_id || !callback_url) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO webhook_subscriptions
        (app_user_id, callback_url)
       VALUES ($1, $2)
       RETURNING *`,
      [app_user_id, callback_url],
    );

    res.status(201).json({
      subscription: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// WEBHOOKS UPDATE SIMULATOR: add a transaction
// in reality the provider calls this whenever data is updated.
app.post("/v1/simulate/transactions", async (req, res) => {
  const { account_id, description, category, amount } = req.body;

  if (
    !account_id ||
    !description ||
    typeof amount !== "number" ||
    !Number.isFinite(amount)
  ) {
    return res.status(400).json({
      error: "Invalid transaction data",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const account = await client.query(
      `UPDATE accounts
       SET balance = balance + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [amount, account_id],
    );

    if (!account.rowCount) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Account not found",
      });
    }

    const transaction = await client.query(
      `INSERT INTO transactions
        (account_id, description, category, amount, transaction_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)
       RETURNING *`,
      [account_id, description, category ?? null, amount],
    );

    // Find application users connected to this account
    const users = await client.query(
      `SELECT DISTINCT c.app_user_id, c.id AS connection_id
       FROM connections c
       JOIN connection_accounts ca
         ON ca.connection_id = c.id
       WHERE ca.account_id = $1
         AND c.status = 'ACTIVE'`,
      [account_id],
    );

    await client.query("COMMIT");

    // Send notifications after the database transaction commits
    for (const user of users.rows) {
      await notifyUser(user.app_user_id, {
        event_id: crypto.randomUUID(),
        event_type: "transaction.created",
        created_at: new Date().toISOString(),
        connection_id: user.connection_id,
        account_id,
        resource_id: transaction.rows[0].id,

        // Include these so SpacetimeDB can process the webhook
        // without making another external API request.
        transaction: transaction.rows[0],
        updated_account: account.rows[0],
      });
    }

    res.status(201).json({
      transaction: transaction.rows[0],
      updated_account: account.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// run server
app.listen(PORT, () => {
  console.log(`Mock API running on port ${PORT}`);
});
