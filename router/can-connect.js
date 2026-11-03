const express = require("express");
const postgres = require("postgres");

const router = express.Router();

// Database connection
const connectionString = process.env.DATABASE_URL;
let sql = null;

// Only initialize database connection if DATABASE_URL is provided
if (connectionString) {
  sql = postgres(connectionString);
}

// Daily connection tracking
const MAX_NUMBER_OF_EXAMS = 100;
const examCountCache = {
  count: null,
  expiresAt: null,
};
const EXAM_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Budget check cache
const budgetCache = {
  exceeded: null,
  expiresAt: null,
};
const BUDGET_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

router.get("/", async (req, res) => {
  try {
    // If no database connection is available (e.g., in test environment)
    if (!sql) {
      return res
        .status(500)
        .json({ error: "Database connection not configured" });
    }

    const now = Date.now();

    // Check budget status first
    let budgetExceeded = false;
    if (budgetCache.expiresAt && budgetCache.expiresAt > now) {
      budgetExceeded = budgetCache.exceeded;
    } else {
      try {
        const budgetResult = await sql`
          SELECT budget_exceeded FROM budget_status WHERE id = 1
        `;
        budgetExceeded =
          budgetResult.length > 0 && budgetResult[0].budget_exceeded;
        budgetCache.exceeded = budgetExceeded;
        budgetCache.expiresAt = now + BUDGET_CACHE_TTL_MS;
      } catch (budgetError) {
        console.error("Error checking budget status:", budgetError);
        // If we can't check budget, allow connection (fail open)
      }
    }

    if (budgetExceeded) {
      return res.json(false);
    }

    // Check if we have cached data that's still valid
    if (examCountCache.expiresAt && examCountCache.expiresAt > now) {
      const canConnect = examCountCache.count < MAX_NUMBER_OF_EXAMS;
      return res.json(canConnect);
    }

    // Calculate timestamp 24 hours ago
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Query to count exam logs in the last 24 hours
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM exam_logs 
      WHERE finished_at >= ${twentyFourHoursAgo}
      AND finished_at IS NOT NULL
    `;

    const count = parseInt(result[0].count);
    console.log("Exams taken in last 24 hours:", count);

    // Cache the result for 30 minutes
    examCountCache.count = count;
    examCountCache.expiresAt = now + EXAM_CACHE_TTL_MS;

    const canConnect = count < MAX_NUMBER_OF_EXAMS;
    res.json(canConnect);
  } catch (error) {
    console.error("Error checking connection limit:", error);
    res.status(500).json({ error: "Failed to check connection limit" });
  }
});

module.exports = router;
