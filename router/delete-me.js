const express = require("express");
const {
  getSupabaseAuthClient,
  getSupabaseAdminClient,
} = require("../supabase/supabase-clients");

const router = express.Router();

router.delete("/", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const accessToken = authHeader.slice("Bearer ".length).trim();

    if (!accessToken) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const authClient = getSupabaseAuthClient();
    const adminClient = getSupabaseAdminClient();

    const {
      data: { user },
      error: getUserError,
    } = await authClient.auth.getUser(accessToken);

    if (getUserError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id,
      false,
    );

    if (deleteError) {
      console.error("Delete account failed", {
        userId: user.id,
        message: deleteError.message,
      });
      return res.status(500).json({ error: deleteError.message });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Delete account failed", {
      message: error.message,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
