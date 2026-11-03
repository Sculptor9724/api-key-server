/**
 * Utility functions for token management
 */

/**
 * Rough estimation of tokens in text
 * GPT models typically use ~4 characters per token for English text
 * This is an approximation for practical use
 */
function estimateTokenCount(text) {
  // Simple approximation: 4 characters ≈ 1 token
  return Math.ceil(text.length / 4);
}

/**
 * Truncates text to stay within a maximum token limit
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens allowed
 * @returns Truncated text that fits within the token limit
 */
function truncateToTokenLimit(text, maxTokens) {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate approximate characters to keep
  const maxCharacters = maxTokens * 4;

  // Truncate and add indication that content was cut
  const truncated = text.substring(0, maxCharacters);

  // Try to cut at a reasonable boundary (end of line) if possible
  const lastNewlineIndex = truncated.lastIndexOf("\n");
  const finalText =
    lastNewlineIndex > maxCharacters * 0.9
      ? truncated.substring(0, lastNewlineIndex)
      : truncated;

  return finalText + "\n\n[Content truncated to fit token limit]";
}

module.exports = truncateToTokenLimit;
