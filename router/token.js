const express = require("express");
const { getEphemeralToken } = require("../utils/gemini-client");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const token = await getEphemeralToken();
    res.json(token);
  } catch (error) {
    console.error("Error getting ephemeral token:", error);
    res.status(500).json({ error: "Failed to get ephemeral token" });
  }
});

module.exports = router;
