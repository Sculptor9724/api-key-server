const getRepoFiles = require("../api/github-repo/get-github-repo-files");
const truncateToTokenLimit = require("../api/github-repo/utils/tokenUtils");

async function getRepoContent(repoUrl, tokenLimit = 28000) {
  if (!repoUrl || typeof repoUrl !== "string") {
    throw new Error("Invalid GitHub repository URL");
  }

  // Normalise the URL so cache keys are consistent and hostname is verified
  let parsedUrl;
  try {
    parsedUrl = new URL(repoUrl.trim());
  } catch {
    throw new Error("Invalid GitHub repository URL");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com") {
    throw new Error("Only https://github.com URLs are supported");
  }
  const normalisedUrl = `https://github.com${parsedUrl.pathname.replace(/\/$/, "")}`;

  const rawRepoContents = await getRepoFiles(normalisedUrl);
  return truncateToTokenLimit(rawRepoContents, tokenLimit);
}

module.exports = getRepoContent;
