const DEFAULT_TREE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CONCURRENT_TREE_REQUESTS = 8;

const treeResponseCache = Object.create(null); // { [owner/repo@ref]: { payload, etag, expiresAt, treeSha } }
const inflightRequests = Object.create(null);
let activeRequests = 0;
const pendingResolvers = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withConcurrencyLimit(fn) {
  if (activeRequests >= MAX_CONCURRENT_TREE_REQUESTS) {
    await new Promise((resolve) => pendingResolvers.push(resolve));
  }

  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
    const next = pendingResolvers.shift();
    if (next) next();
  }
}

async function handleRateLimitBackoff(response) {
  const status = response.status;
  if (status !== 403 && status !== 429) return;

  const retryAfter = response.headers.get("retry-after");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");

  let waitMs = 0;
  if (retryAfter) {
    const parsed = Number(retryAfter);
    if (!Number.isNaN(parsed)) {
      waitMs = parsed * 1000;
    }
  } else if (rateLimitReset) {
    const resetEpochSeconds = Number(rateLimitReset);
    if (!Number.isNaN(resetEpochSeconds)) {
      waitMs = Math.max(resetEpochSeconds * 1000 - Date.now(), 0);
    }
  }

  if (waitMs > 0) {
    const capped = Math.min(waitMs, 30_000); // avoid excessively long waits
    await delay(capped);
  }
}

function decorateTreeResponse(cacheEntry, ref) {
  if (!cacheEntry || !cacheEntry.payload) return null;
  return {
    ...cacheEntry.payload,
    refUsed: ref,
    treeSha: cacheEntry.treeSha,
    etag: cacheEntry.etag,
  };
}

function createTryFetchTreeByRef(owner, repoName, fetcherOrOptions) {
  if (!owner || !repoName) {
    throw new Error("Invalid arguments for tryFetchTreeByRef");
  }

  // Legacy signature support to avoid breaking existing call sites
  if (typeof fetcherOrOptions === "function") {
    const legacyFetchJson = fetcherOrOptions;
    return async function tryFetchTreeByRef(ref) {
      if (!ref) return null;
      const url = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${encodeURIComponent(
        ref,
      )}?recursive=1`;
      try {
        const data = await legacyFetchJson(url);
        if (!data || !Array.isArray(data.tree)) return null;
        return { ...data, refUsed: ref };
      } catch (error) {
        return null;
      }
    };
  }

  const options = fetcherOrOptions || {};
  const fetchImpl = options.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation must be provided when using tryFetchTreeByRef options mode");
  }

  const baseHeaders = options.headers || {};
  const cacheTtlMs = typeof options.cacheTtlMs === "number" ? options.cacheTtlMs : DEFAULT_TREE_CACHE_TTL_MS;
  const cacheKeyPrefix = `${owner}/${repoName}`;

  return async function tryFetchTreeByRef(ref) {
    if (!ref) return null;

    const cacheKey = `${cacheKeyPrefix}@${ref}`;
    const cached = treeResponseCache[cacheKey];
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return decorateTreeResponse(cached, ref);
    }

    if (inflightRequests[cacheKey]) {
      return inflightRequests[cacheKey];
    }

    const requestPromise = (async () => {
      const requestHeaders = { ...baseHeaders };
      if (cached?.etag) {
        requestHeaders["If-None-Match"] = cached.etag;
      }

      const url = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${encodeURIComponent(
        ref,
      )}?recursive=1`;

      let response;
      try {
        response = await withConcurrencyLimit(() => fetchImpl(url, { headers: requestHeaders }));
      } catch (error) {
        return decorateTreeResponse(cached, ref);
      }

      if (response.status === 304 && cached) {
        cached.expiresAt = now + cacheTtlMs;
        cached.fetchedAt = now;
        return decorateTreeResponse(cached, ref);
      }

      if (!response.ok) {
        await handleRateLimitBackoff(response);
        return decorateTreeResponse(cached, ref);
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        return decorateTreeResponse(cached, ref);
      }

      if (!data || !Array.isArray(data.tree)) {
        return decorateTreeResponse(cached, ref);
      }

      const entry = {
        payload: data,
        etag: response.headers.get("etag"),
        fetchedAt: Date.now(),
        expiresAt: Date.now() + cacheTtlMs,
        treeSha: data.sha || null,
      };
      treeResponseCache[cacheKey] = entry;
      return decorateTreeResponse(entry, ref);
    })();

    inflightRequests[cacheKey] = requestPromise;

    try {
      return await requestPromise;
    } finally {
      delete inflightRequests[cacheKey];
    }
  };
}

module.exports = createTryFetchTreeByRef;
