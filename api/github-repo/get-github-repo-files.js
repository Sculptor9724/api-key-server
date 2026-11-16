const createTryFetchTreeByRef = require("./utils/tryFetchTreeByRef");

// Simple in-memory cache for repository files
const repoFilesCache = {}; // { [repoUrl]: { files, expiresAt } }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getRepoFiles(
  repoUrl,
  maxFiles = 10,
  basePath = "app/src/main/java/com/example",
) {
  const githubApiKey = process.env.GITHUB_API_KEY;

  // Check cache first
  const cached = repoFilesCache[repoUrl];
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    console.log(`Using cached repository files for: ${repoUrl}`);
    return cached.files;
  }

  // Validate the URL strictly before extracting owner/repo
  let parsedUrl;
  try {
    parsedUrl = new URL(repoUrl);
  } catch {
    throw new Error("Invalid GitHub repository URL");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com") {
    throw new Error("Only https://github.com URLs are supported");
  }

  // Extract the owner and repo name from the validated URL path
  const regex = /^\/([^\/]+)\/([^\/]+?)(\.git)?\/?$/;
  const match = parsedUrl.pathname.match(regex);
  if (!match) {
    throw new Error("Invalid GitHub repository URL");
  }

  const owner = match[1];
  const repoName = match[2];

  // Delay helper to be gentle with the API
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const delayMs = 100;

  // Shared headers
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubApiKey) {
    headers.Authorization = `Bearer ${githubApiKey}`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let bodyText = "";
      try {
        const data = await res.json();
        bodyText = data && (data.message || JSON.stringify(data));
      } catch (_) {
        try {
          bodyText = await res.text();
        } catch (_) {
          bodyText = "";
        }
      }
      throw new Error(`GitHub API error ${res.status}: ${bodyText}`);
    }
    return res.json();
  }

  // Try HEAD, then common branches; if needed, fall back to default_branch
  const tryFetchTreeByRef = createTryFetchTreeByRef(owner, repoName, fetchJson);
  let treeData =
    (await tryFetchTreeByRef("HEAD")) ||
    (await tryFetchTreeByRef("main")) ||
    (await tryFetchTreeByRef("master"));

  if (!treeData) {
    // Fetch default_branch as a fallback (costs 1 extra request)
    const repoInfo = await fetchJson(
      `https://api.github.com/repos/${owner}/${repoName}`,
    );
    if (repoInfo && repoInfo.default_branch) {
      treeData = await tryFetchTreeByRef(repoInfo.default_branch);
    }
  }

  if (!treeData) {
    throw new Error("Failed to fetch repository tree");
  }

  const { tree, truncated } = treeData;
  if (truncated) {
    console.log(
      "Git Trees API response truncated; proceeding with available entries.",
    );
  }

  // 2) Filter paths locally before fetching contents
  const ignoreDirs = [
    "build/",
    "target/",
    ".gradle/",
    ".idea/",
    ".git/",
    "out/",
    "bin/",
  ];
  const ignoreFileNameExact = new Set(["R.java", "BuildConfig.java", ".gitignore", "AndroidManifest.xml"]);
  const ignoreFileNameRegex = [/\.gradle$/i, /\.gradle\.kts$/i];

  function isIgnoredPath(path) {
    const lower = path.toLowerCase();
    // Ignore directories at any level
    for (const dir of ignoreDirs) {
      const dLower = dir.toLowerCase();
      if (lower.startsWith(dLower) || lower.includes(`/${dLower}`)) return true;
      // Also handle cases where the leading slash logic isn't matched exactly
      if (lower.includes(`/${dLower.replace(/\/$/, "")}/`)) return true;
    }
    const base = path.split("/").pop();
    if (ignoreFileNameExact.has(base)) return true;
    if (ignoreFileNameRegex.some((re) => re.test(base))) return true;
    return false;
  }

  function scorePath(path) {
    const lower = path.toLowerCase();
    const base = path.split("/").pop();
    const baseLower = base.toLowerCase();
    let score = 0;

    // Prefer Kotlin slightly
    if (lower.endsWith(".kt")) score += 1;
    if (lower.endsWith(".java")) score += 0.8;

    // Android / general Java locations
    if (lower.includes("src/main/java") || lower.includes("src/main/kotlin"))
      score += 3;
    if (lower.startsWith("app/src/main/java") || lower.startsWith("app/src/main/kotlin"))
      score += 2;

    // Android typical classes
    ["mainactivity", "screen", "viewmodel", "repository"].forEach((k) => {
      if (baseLower.includes(k)) score += 2;
    });
    ["/ui/", "/screen/", "/feature/"].forEach((seg) => {
      if (lower.includes(seg)) score += 1;
    });

    // Spring Boot / Java backend patterns
    if (baseLower.includes("application")) score += 0.8;
    ["controller", "service", "repository"].forEach((k) => {
      if (lower.includes(`/${k}/`)) score += 2;
      if (baseLower.includes(k)) score += 1;
    });

    // Plain Java heuristics
    if (lower.startsWith("src/")) score += 1;
    if (lower.includes("/test/")) score -= 2;

    // Downrank config/dto/generated/noise
    ["/config/", "/dto/", "/generated/", "/build/", "/target/"].forEach(
      (seg) => {
        if (lower.includes(seg)) score -= 1;
      },
    );

    // Hard downrank known generated
    if (baseLower === "r.java" || baseLower === "buildconfig.java") score -= 5;

    return score;
  }

  // Keep only Kotlin/Java source files and ignore noise
  const candidates = tree
    .filter((item) => item.type === "blob")
    .filter((item) =>
      item.path.endsWith(".kt") || item.path.endsWith(".java"),
    )
    .filter((item) => !isIgnoredPath(item.path))
    .map((item) => ({
      name: item.path.split("/").pop(),
      path: item.path,
      sha: item.sha,
      score: scorePath(item.path),
    }));

  // If a basePath was provided and looks like a folder, lightly prefer it
  if (basePath && typeof basePath === "string" && basePath.length > 1) {
    candidates.forEach((c) => {
      if (c.path.startsWith(basePath)) c.score += 1;
    });
  }

  // Sort by score and deterministic tiebreaker (shorter path first)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.path.length - b.path.length;
  });

  // 3) Fetch contents only for shortlisted files
  const selected = candidates.slice(0, Math.min(maxFiles, candidates.length));

  async function fetchFileContentByBlobSha(sha) {
    try {
      const blob = await fetchJson(
        `https://api.github.com/repos/${owner}/${repoName}/git/blobs/${sha}`,
      );
      let content = "";
      if (blob && blob.encoding === "base64" && blob.content) {
        try {
          content = Buffer.from(blob.content, "base64").toString("utf8");
        } catch (_) {
          content = "";
        }
      }
      // Remove lines starting with 'import '
      content = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("import "))
        .join("\n");
      return content;
    } catch (error) {
      console.log("Error fetching blob:", error.message || error);
      return "";
    }
  }

  let result = "";
  //console.log(`Fetching contents for ${selected.length} shortlisted file(s) out of ${candidates.length} candidates`,);
  for (let i = 0; i < selected.length; i++) {
    const file = selected[i];
    //console.log(`Processing ${i + 1}/${selected.length}: ${file.path}`);
    await delay(delayMs);
    const content = await fetchFileContentByBlobSha(file.sha);
    result += "```\n" + file.path + "\n```\n" + content + "\n```\n\n";
  }

  // Store result in cache before returning
  const cacheTime = Date.now();
  repoFilesCache[repoUrl] = {
    files: result,
    expiresAt: cacheTime + CACHE_TTL_MS,
  };

  console.log(`Repository files cached for: ${repoUrl}`);
  return result;
}

module.exports = getRepoFiles;
