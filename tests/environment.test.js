const request = require("supertest");
const express = require("express");

/**
 * Critical Environment Variables Tests
 * These tests ensure all required API keys are present and valid
 * This is the most important test suite for preventing deployment failures
 */
describe("🔑 Environment Variables & API Keys", () => {
  describe("Required Environment Variables", () => {
    test("GEMINI_API_KEY should be present and valid format", () => {
      expect(process.env.GEMINI_API_KEY).toBeDefined();
      expect(process.env.GEMINI_API_KEY).not.toBe("");
      expect(process.env.GEMINI_API_KEY).toMatch(/^AIza[A-Za-z0-9_-]{35}$/);
    });

  });

  describe("API Key Functionality Tests", () => {
    test("GitHub API key should have proper permissions", async () => {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_API_KEY}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);

      if (response.status !== 200) {
        console.error("GitHub API Response Status:", response.status);
        console.error("GitHub API Response:", await response.text());
      }

      // Should be 200 (authenticated user) or 404 (token valid but user private)
      expect([200, 404]).toContain(response.status);
    }, 15000);

    test("GitHub API key should be able to access public repositories", async () => {
      // Test with a known public repository
      const response = await fetch(
        "https://api.github.com/repos/octocat/Hello-World/contents",
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_API_KEY}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }, 15000);
  });

  describe("Environment File Security", () => {
    test(".env file should not contain placeholder values", () => {
      expect(process.env.GEMINI_API_KEY).not.toMatch(
        /your.*key|placeholder|example/i,
      );
      expect(process.env.GITHUB_API_KEY).not.toMatch(
        /your.*key|placeholder|example/i
      );
    });

    test("API keys should not be empty strings or undefined", () => {
      expect(process.env.GEMINI_API_KEY?.trim()).toBeTruthy();
      expect(process.env.GITHUB_API_KEY?.trim()).toBeTruthy();
    });
  });
});
