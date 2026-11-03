const createTryFetchTreeByRef = require("./utils/tryFetchTreeByRef");

const repoTreeCache = Object.create(null); // { [repoUrl]: { tree, expiresAt, ref, treeSha } }
const repoMetadataCache = Object.create(null); // { [owner/repo]: { data, etag, expiresAt } }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_TREE_ENTRIES = 400;

function validateGitHubUrl(repoUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(repoUrl);
  } catch {
    throw new Error("Invalid GitHub repository URL");
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com") {
    throw new Error("Only https://github.com URLs are supported");
  }

  const regex = /^\/([^\/]+)\/([^\/]+?)(\.git)?\/?$/;
  const match = parsedUrl.pathname.match(regex);

  if (!match) {
    throw new Error("Invalid GitHub repository URL");
  }

  return { owner: match[1], repoName: match[2], normalisedUrl: `https://github.com${match[0]}` };
}

function buildBaseHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_API_KEY) {
    headers.Authorization = `Bearer ${process.env.GITHUB_API_KEY}`;
  }

  return headers;
}

function parseRateLimit(headers) {
  if (!headers || typeof headers.get !== "function") return null;
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const used = headers.get("x-ratelimit-used");
  return { limit, remaining, reset, used };
}

function maybeLogLowRateLimit(rateInfo, context) {
  if (!rateInfo) return;
  const remaining = Number(rateInfo.remaining);
  if (Number.isNaN(remaining)) return;
  if (remaining > 50) return;
  console.warn(
    `GitHub API rate limit low (${remaining}/${rateInfo.limit} remaining) while ${context}. Reset at ${rateInfo.reset}.`,
  );
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    if (data && typeof data === "object") {
      return data.message || JSON.stringify(data);
    }
  } catch (_) {
    // swallow parsing errors and fall back to text
  }

  try {
    return await response.text();
  } catch (_) {
    return "";
  }
}

async function fetchGitHubJson(url, baseHeaders, { etag, context } = {}) {
  const headers = { ...baseHeaders };
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const res = await fetch(url, { headers });
  const rateInfo = parseRateLimit(res.headers);
  if (context) {
    maybeLogLowRateLimit(rateInfo, context);
  }

  if (res.status === 304) {
    return { status: 304, etag: etag, rateInfo };
  }

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    const rateSuffix =
      rateInfo && rateInfo.remaining != null
        ? ` (remaining: ${rateInfo.remaining}/${rateInfo.limit})`
        : "";
    throw new Error(`GitHub API error ${res.status}: ${message}${rateSuffix}`);
  }

  const data = await res.json();
  return { status: res.status, data, etag: res.headers.get("etag"), rateInfo };
}

async function getRepoMetadata(owner, repoName, baseHeaders) {
  const cacheKey = `${owner}/${repoName}`;
  const cached = repoMetadataCache[cacheKey];
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const response = await fetchGitHubJson(
    `https://api.github.com/repos/${owner}/${repoName}`,
    baseHeaders,
    { etag: cached?.etag, context: `fetching metadata for ${cacheKey}` },
  );

  if (response.status === 304 && cached) {
    cached.expiresAt = now + CACHE_TTL_MS;
    cached.fetchedAt = now;
    return cached.data;
  }

  if (!response.data) {
    throw new Error(`Unable to load repository metadata for ${cacheKey}`);
  }

  repoMetadataCache[cacheKey] = {
    data: response.data,
    etag: response.etag,
    fetchedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  };

  return response.data;
}

async function getRepoDirectoryTree(repoUrl) {
  const { owner, repoName, normalisedUrl } = validateGitHubUrl(repoUrl);
  const now = Date.now();

  const cachedTree = repoTreeCache[normalisedUrl];
  if (cachedTree && cachedTree.expiresAt > now) {
    return cachedTree.tree;
  }

  const baseHeaders = buildBaseHeaders();
  const metadata = await getRepoMetadata(owner, repoName, baseHeaders);
  const defaultBranch = metadata && metadata.default_branch;
  if (!defaultBranch) {
    throw new Error(`Repository ${owner}/${repoName} does not expose a default branch`);
  }

  const tryFetchTreeByRef = createTryFetchTreeByRef(owner, repoName, {
    headers: baseHeaders,
    cacheTtlMs: CACHE_TTL_MS,
  });
  const treeData = await tryFetchTreeByRef(defaultBranch);

  if (!treeData) {
    throw new Error(`Failed to fetch repository tree for ${owner}/${repoName} (ref: ${defaultBranch})`);
  }

  const entries = treeData.tree
    .filter((item) => item && (item.type === "tree" || item.type === "blob"))
    .map((item) => ({ path: item.path, type: item.type }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const limitedEntries = entries.slice(0, MAX_TREE_ENTRIES);
  const formattedEntries = limitedEntries
    .map((entry) => {
      const depth = Math.max(entry.path.split("/").length - 1, 0);
      const indent = depth > 0 ? "  ".repeat(depth) : "";
      const icon = entry.type === "tree" ? "📁" : "📄";
      const name = entry.path.split("/").pop();
      const suffix = name && name !== entry.path ? ` (${entry.path})` : "";
      return `${indent}${icon} ${name || entry.path}${suffix}`;
    })
    .join("\n");

  let result = `Repository: ${owner}/${repoName}`;
  if (treeData.refUsed) {
    result += ` (ref: ${treeData.refUsed})`;
  }
  result += "\n";
  result += formattedEntries || "[No repository entries found]";

  if (entries.length > MAX_TREE_ENTRIES) {
    result += `\n… +${entries.length - MAX_TREE_ENTRIES} more entries`;
  }

  if (treeData.truncated) {
    result +=
      "\n⚠️ GitHub truncated the directory listing; some paths may be missing.";
  }

  repoTreeCache[normalisedUrl] = {
    tree: result,
    expiresAt: now + CACHE_TTL_MS,
    ref: treeData.refUsed || defaultBranch,
    treeSha: treeData.treeSha || treeData.sha || null,
    cachedAt: now,
  };

  return result;
}

module.exports = getRepoDirectoryTree;
