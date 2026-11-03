const mockCreateClient = jest.fn(() => ({
  auth: {
    getUser: jest.fn(),
    admin: {
      deleteUser: jest.fn(),
    },
  },
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args) => mockCreateClient(...args),
}));

describe("supabase-clients", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
      SUPABASE_SECRET_KEY: "sb_secret_test_key",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("creates the auth client with the publishable API key", () => {
    const { getSupabaseAuthClient } = require("../supabase/supabase-clients");

    getSupabaseAuthClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test_key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });

  test("creates the admin client with the secret API key", () => {
    const { getSupabaseAdminClient } = require("../supabase/supabase-clients");

    getSupabaseAdminClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_secret_test_key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });

  test("throws when the publishable key is missing", () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    const { getSupabaseAuthClient } = require("../supabase/supabase-clients");

    expect(() => getSupabaseAuthClient()).toThrow(
      "Missing Supabase auth client configuration",
    );
  });

  test("throws when the secret key is missing", () => {
    delete process.env.SUPABASE_SECRET_KEY;
    const { getSupabaseAdminClient } = require("../supabase/supabase-clients");

    expect(() => getSupabaseAdminClient()).toThrow(
      "Missing Supabase admin client configuration",
    );
  });
});
