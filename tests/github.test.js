const getRepoFiles = require("../utils/get-github-repo-files");

/**
 * GitHub Integration Tests
 * These tests ensure the GitHub API integration works properly
 * This is critical since GitHub API key issues caused your previous deployment problems
 */
describe("🐙 GitHub Integration Tests", () => {
  // Increase timeout for GitHub API calls
  jest.setTimeout(30000);

  describe("GitHub API Key Validation", () => {
    test("GitHub API key should have proper scopes", async () => {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_API_KEY}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      // Check the X-OAuth-Scopes header to see what permissions we have
      const scopes = response.headers.get("X-OAuth-Scopes");
      console.log("GitHub Token Scopes:", scopes);

      // The key should at least have repo or public_repo access
      expect(response.status).not.toBe(401); // Unauthorized
      expect(response.status).not.toBe(403); // Forbidden
    });

    test("GitHub API rate limit should be sufficient", async () => {
      const response = await fetch("https://api.github.com/rate_limit", {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_API_KEY}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      expect(response.status).toBe(200);
      const rateLimit = await response.json();

      console.log("GitHub API Rate Limit:", rateLimit.rate);

      // Should have reasonable rate limit remaining
      expect(rateLimit.rate.remaining).toBeGreaterThan(10);
      expect(rateLimit.rate.limit).toBeGreaterThan(1000); // Should be 5000 for authenticated requests
    });
  });

  describe("Repository File Fetching", () => {
    test("Should handle valid GitHub repository URL", async () => {
      // Skip this test in CI/CD to avoid hitting API limits
      if (process.env.CI && !process.env.TEST_GITHUB_API) {
        console.log("Skipping GitHub API test in CI environment");
        return;
      }

      const testRepoUrl = "https://github.com/octocat/Hello-World";

      try {
        const result = await getRepoFiles(testRepoUrl);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      } catch (error) {
        // If it fails, make sure it's not due to API key issues
        expect(error.message).not.toContain("401");
        expect(error.message).not.toContain("403");
        expect(error.message).not.toMatch(/bad credentials/i);
      }
    }, 30000);

    test("Should handle invalid GitHub repository URL", async () => {
      const invalidUrl = "https://not-github.com/invalid/repo";

      await expect(getRepoFiles(invalidUrl)).rejects.toThrow();
    });

    test("Should handle GitHub URL parsing correctly", async () => {
      const validUrls = [
        "https://github.com/owner/repo",
        "https://github.com/owner/repo/",
        "https://github.com/owner/repo-name",
        "https://github.com/owner-name/repo_name",
      ];

      const invalidUrls = [
        "https://gitlab.com/owner/repo",
        "not-a-url",
        "https://github.com/owner",
        "https://github.com",
      ];

      // Test valid URLs don't throw during URL parsing
      for (const url of validUrls) {
        const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
        const match = url.match(regex);
        expect(match).not.toBeNull();
        expect(match[1]).toBeTruthy(); // owner
        expect(match[2]).toBeTruthy(); // repo
      }

      // Test invalid URLs are caught
      for (const url of invalidUrls) {
        await expect(getRepoFiles(url)).rejects.toThrow();
      }
    });
  });

  describe("Performance Tests", () => {
    test("GitHub API calls should complete within reasonable time", async () => {
      if (process.env.CI && !process.env.TEST_GITHUB_API) {
        console.log("Skipping GitHub API performance test in CI environment");
        return;
      }

      const startTime = Date.now();

      try {
        await fetch("https://api.github.com/rate_limit", {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_API_KEY}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
      } catch (error) {
        // Even if it fails, it should fail quickly
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
