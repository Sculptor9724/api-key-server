const { getSupabaseAuthClient } = require("../supabase/supabase-clients");

async function authenticate(req, res, next) {
  if (
    process.env.DISABLE_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const supabase = getSupabaseAuthClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).send("Unauthorized: Invalid token");
    }

    if (!user) {
      return res.status(403).send("Forbidden: Access denied");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication failed", { message: error.message });
    res.status(500).send("Internal Server Error");
  }
}

module.exports = authenticate;
