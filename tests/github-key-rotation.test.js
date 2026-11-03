const getRepoFiles = require("../utils/get-github-repo-files");

describe("GitHub API key rotation", () => {
  const originalFetch = global.fetch;
  const originalPrimaryKey = process.env.GITHUB_API_KEY;
  const originalSecondaryKey = process.env.GITHUB_API_KEY_BENNA;

  beforeEach(() => {
    if (typeof getRepoFiles.__resetGithubApiKeyRotation === "function") {
      getRepoFiles.__resetGithubApiKeyRotation();
    }

    process.env.GITHUB_API_KEY = "primary-token";
    process.env.GITHUB_API_KEY_BENNA = "secondary-token";

    global.fetch = jest.fn(async (url, options = {}) => {
      if (url.includes("/git/trees/")) {
        return {
          ok: true,
          json: async () => ({
            tree: [
              {
                type: "blob",
                path: "src/main/java/com/example/App.java",
                sha: "blob-sha-1",
              },
            ],
          }),
          headers: {
            get: () => null,
          },
        };
      }

      if (url.includes("/git/blobs/")) {
        return {
          ok: true,
          json: async () => ({
            encoding: "base64",
            content: Buffer.from("class App {}", "utf8").toString("base64"),
          }),
          headers: {
            get: () => null,
          },
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;

    if (originalPrimaryKey === undefined) {
      delete process.env.GITHUB_API_KEY;
    } else {
      process.env.GITHUB_API_KEY = originalPrimaryKey;
    }

    if (originalSecondaryKey === undefined) {
      delete process.env.GITHUB_API_KEY_BENNA;
    } else {
      process.env.GITHUB_API_KEY_BENNA = originalSecondaryKey;
    }
  });

  test("alternates between configured GitHub keys for each repo fetch request", async () => {
    await getRepoFiles("https://github.com/example-org/example-repo-one");
    await getRepoFiles("https://github.com/example-org/example-repo-two");

    const authHeaders = global.fetch.mock.calls.map(
      ([, options]) => options.headers.Authorization,
    );

    expect(authHeaders).toHaveLength(4);
    expect(authHeaders.slice(0, 2)).toEqual([
      "Bearer primary-token",
      "Bearer primary-token",
    ]);
    expect(authHeaders.slice(2, 4)).toEqual([
      "Bearer secondary-token",
      "Bearer secondary-token",
    ]);
  });

  test("falls back to the primary GitHub key when the secondary key is missing", async () => {
    delete process.env.GITHUB_API_KEY_BENNA;

    await getRepoFiles("https://github.com/example-org/example-repo-three");
    await getRepoFiles("https://github.com/example-org/example-repo-four");

    const authHeaders = global.fetch.mock.calls.map(
      ([, options]) => options.headers.Authorization,
    );

    expect(authHeaders).toHaveLength(4);
    expect(new Set(authHeaders)).toEqual(new Set(["Bearer primary-token"]));
  });
});
