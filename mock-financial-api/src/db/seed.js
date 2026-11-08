import { pool } from "./pool.js";
import { CUSTOMERS, TRANSACTION_MONTHS } from "./mock-data.js";

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Reset demo data
    await client.query(`
      TRUNCATE
        webhook_subscriptions,
        connection_accounts,
        connections,
        auth_sessions,
        transactions,
        investment_holdings,
        loans,
        accounts,
        institutions,
        customers
      CASCADE
    `);

    // Create customers
    for (const customer of CUSTOMERS) {
      const customerResult = await client.query(
        `INSERT INTO customers (name)
         VALUES ($1)
         RETURNING id`,
        [customer.name],
      );

      const customerId = customerResult.rows[0].id;

      // Create institutions
      for (const institution of customer.institutions) {
        const institutionResult = await client.query(
          `INSERT INTO institutions (name, institution_type)
           VALUES ($1, $2)
           RETURNING id`,
          [institution.name, institution.type],
        );

        const institutionId = institutionResult.rows[0].id;

        // Create accounts
        for (const account of institution.accounts) {
          const accountResult = await client.query(
            `INSERT INTO accounts
              (customer_id, institution_id, name, account_type,
               account_mask, balance)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              customerId,
              institutionId,
              account.name,
              account.type,
              account.mask,
              account.balance,
            ],
          );

          const accountId = accountResult.rows[0].id;

          // Insert loan details if applicable
          if (account.loanDetails) {
            const loan = account.loanDetails;

            await client.query(
              `INSERT INTO loans
                (account_id, original_principal, remaining_principal,
                 interest_rate, interest_type, minimum_payment, due_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                accountId,
                loan.originalPrincipal,
                loan.remainingPrincipal,
                loan.interestRate,
                loan.interestType,
                loan.minimumPayment,
                loan.dueDate,
              ],
            );
          }

          // Insert investment holdings if applicable
          if (account.holdings?.length) {
            for (const holding of account.holdings) {
              await client.query(
                `INSERT INTO investment_holdings
                  (account_id, symbol, name, shares, price_per_share)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  accountId,
                  holding.symbol,
                  holding.name,
                  holding.shares,
                  holding.pricePerShare,
                ],
              );
            }
          }

          // Generate historical transactions if applicable
          if (account.transactions?.length) {
            for (let month = TRANSACTION_MONTHS - 1; month >= 0; month--) {
              for (let i = 0; i < account.transactions.length; i++) {
                const transaction = account.transactions[i];

                // Generate a date within each historical month
                const date = new Date();
                date.setDate(1);
                date.setMonth(date.getMonth() - month);
                date.setDate(Math.min(2 + i * 2, 28));

                await client.query(
                  `INSERT INTO transactions
                    (account_id, description, category, amount, transaction_date)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [
                    accountId,
                    transaction.description,
                    transaction.category,
                    transaction.amount,
                    date.toISOString().slice(0, 10),
                  ],
                );
              }
            }
          }
        }
      }

      console.log(`Seeded customer: ${customer.name} (${customerId})`);
    }

    await client.query("COMMIT");

    console.log("Successfully seeded mock financial data!");
    console.log(`Customers seeded: ${CUSTOMERS.length}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
