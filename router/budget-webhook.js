const express = require("express");
const postgres = require("postgres");

const router = express.Router();

const connectionString = process.env.DATABASE_URL;
let sql = null;

if (connectionString) {
  sql = postgres(connectionString);
}

router.post("/", async (req, res) => {
  try {
    // Verify the shared secret token
    const token = req.query.token;
    if (
      !process.env.BUDGET_WEBHOOK_SECRET ||
      token !== process.env.BUDGET_WEBHOOK_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!sql) {
      return res
        .status(500)
        .json({ error: "Database connection not configured" });
    }

    // Pub/Sub sends a message wrapper with a base64-encoded data field
    const message = req.body.message;
    if (!message || !message.data) {
      return res.status(400).json({ error: "Invalid Pub/Sub message" });
    }

    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8"),
    );

    const costAmount = data.costAmount;
    const budgetAmount = data.budgetAmount;
    const budgetName = data.budgetDisplayName;
    const currencyCode = data.currencyCode;

    if (costAmount == null || budgetAmount == null) {
      return res
        .status(400)
        .json({ error: "Missing costAmount or budgetAmount" });
    }

    const budgetExceeded = costAmount >= budgetAmount;

    await sql`
      INSERT INTO budget_status (id, cost_amount, budget_amount, budget_exceeded, budget_name, currency_code, updated_at)
      VALUES (1, ${costAmount}, ${budgetAmount}, ${budgetExceeded}, ${budgetName || null}, ${currencyCode || null}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        cost_amount = ${costAmount},
        budget_amount = ${budgetAmount},
        budget_exceeded = ${budgetExceeded},
        budget_name = ${budgetName || null},
        currency_code = ${currencyCode || null},
        updated_at = NOW()
    `;

    console.log(
      `Budget update: ${costAmount}/${budgetAmount} ${currencyCode} (exceeded: ${budgetExceeded})`,
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error processing budget webhook:", error);
    res.status(500).json({ error: "Failed to process budget notification" });
  }
});

module.exports = router;
