const request = require("supertest");

const mockGetUser = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("../supabase/supabase-clients", () => ({
  getSupabaseAuthClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
  getSupabaseAdminClient: jest.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

const app = require("../index");

describe("DELETE /api/me", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockDeleteUser.mockReset();
  });

  test("returns 401 when the bearer token is missing", async () => {
    const response = await request(app)
      .delete("/api/me")
      .send({ confirmation: "DELETE" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing bearer token" });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("returns 401 when the token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const response = await request(app)
      .delete("/api/me")
      .set("Authorization", "Bearer invalid-token")
      .send({ confirmation: "DELETE" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid or expired token" });
    expect(mockGetUser).toHaveBeenCalledWith("invalid-token");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("returns 204 and deletes only the validated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });

    const response = await request(app)
      .delete("/api/me")
      .set("Authorization", "Bearer valid-token")
      .send({ confirmation: "DELETE", userId: "attacker-controlled-id" });

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(mockGetUser).toHaveBeenCalledWith("valid-token");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123", false);
  });

  test("returns 500 when admin deletion fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({
      error: { message: "database constraint failure" },
    });

    const response = await request(app)
      .delete("/api/me")
      .set("Authorization", "Bearer valid-token")
      .send({ confirmation: "DELETE" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "database constraint failure" });
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123", false);
  });
});
