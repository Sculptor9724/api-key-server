require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function getGeminiChatCompletion(
  systemPrompt,
  prompt,
  responseSchema,
  model = DEFAULT_MODEL,
  temperature,
) {
  const config = {};

  if (temperature !== undefined) {
    config.temperature = temperature;
  }

  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  if (responseSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = responseSchema;
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  if (responseSchema) {
    return JSON.parse(response.text);
  }

  return response.text;
}

module.exports = { getGeminiChatCompletion };
