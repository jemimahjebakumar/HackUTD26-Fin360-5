import "dotenv/config";

import { pool } from "./db/pool.js";

export async function notifyUser(appUserId, event) {
  const result = await pool.query(
    `SELECT callback_url
     FROM webhook_subscriptions
     WHERE app_user_id = $1 AND active = TRUE`,
    [appUserId],
  );

  const body = JSON.stringify(event);

  for (const subscription of result.rows) {
    try {
      const response = await fetch(subscription.callback_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mock-Signature": process.env.WEBHOOK_SECRET,
        },
        body,
      });

      if (!response.ok) {
        console.error("Webhook delivery failed:", response.status);
      }
    } catch (err) {
      console.error("Webhook request failed:", err);
    }
  }
}
