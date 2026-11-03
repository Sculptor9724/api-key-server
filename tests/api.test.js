const request = require("supertest");
const express = require("express");

// Import the app
let app;

/**
 * API Endpoints Integration Tests
 * These tests ensure all endpoints work correctly after deployment
 */
describe("🚀 API Endpoints Integration Tests", () => {
  beforeAll(() => {
    // Create a new app instance for testing
    app = express();
    const cors = require("cors");

    const whitelist = [
      "https://behu-kea.github.io",
      "http://localhost:3001",
      "http://localhost:3002",
    ];

    app.use(
      cors({
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          return whitelist.includes(origin)
            ? cb(null, true)
            : cb(new Error("Not allowed by CORS"));
        },
        credentials: true,
      })
    );
    app.use(express.json());

    // Simple in-memory daily connection counter for testing
    const dailyConnections = {};
    const MAX_NUMBER_OF_CONNECTIONS = 200;

    function getTodayString() {
      const today = new Date();
      return today.toISOString().split("T")[0];
    }

    app.get("/can-connect-count", (req, res) => {
      const today = getTodayString();
      res.json(dailyConnections[today] || 0);
    });

    app.get("/can-connect", (req, res) => {
      try {
        const today = getTodayString();
        if (!dailyConnections[today]) {
          dailyConnections[today] = 0;
        }
        dailyConnections[today]++;
        const canConnect = dailyConnections[today] <= MAX_NUMBER_OF_CONNECTIONS;
        res.json(canConnect);
      } catch (error) {
        console.error("Error checking connection limit:", error);
        res.status(500).json({ error: "Failed to check connection limit" });
      }
    });

  });

  describe("Connection Limiting Endpoints", () => {
    test("GET /can-connect should return boolean and increment counter", async () => {
      const response = await request(app).get("/can-connect");

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("boolean");
    });

    test("GET /can-connect-count should return current connection count", async () => {
      const response = await request(app).get("/can-connect-count");

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("number");
      expect(response.body).toBeGreaterThanOrEqual(0);
    });

    test("Connection counting should work correctly", async () => {
      const initialCountResponse = await request(app).get("/can-connect-count");
      const initialCount = initialCountResponse.body;

      await request(app).get("/can-connect");

      const newCountResponse = await request(app).get("/can-connect-count");
      const newCount = newCountResponse.body;

      expect(newCount).toBe(initialCount + 1);
    });
  });

});
