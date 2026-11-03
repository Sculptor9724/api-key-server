const { createClient } = require("@supabase/supabase-js");

function createServerClient(key) {
  return createClient(process.env.SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabaseAuthClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase auth client configuration");
  }

  return createServerClient(process.env.SUPABASE_PUBLISHABLE_KEY);
}

function getSupabaseAdminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase admin client configuration");
  }

  return createServerClient(process.env.SUPABASE_SECRET_KEY);
}

module.exports = {
  getSupabaseAuthClient,
  getSupabaseAdminClient,
};
