const getRepoFiles = require("../utils/get-github-repo-files");

describe("GitHub API authentication", () => {
  const originalFetch = global.fetch;
  const originalPrimaryKey = process.env.GITHUB_API_KEY;

  beforeEach(() => {
    process.env.GITHUB_API_KEY = "primary-token";

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
  });

  test("uses the configured GitHub key for each repo fetch request", async () => {
    await getRepoFiles("https://github.com/example-org/example-repo-one");
    await getRepoFiles("https://github.com/example-org/example-repo-two");

    const authHeaders = global.fetch.mock.calls.map(
      ([, options]) => options.headers.Authorization,
    );

    expect(authHeaders).toHaveLength(4);
    expect(authHeaders).toEqual(Array(4).fill("Bearer primary-token"));
  });
});
