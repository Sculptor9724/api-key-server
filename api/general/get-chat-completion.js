require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getGeminiChatCompletion(
  systemPrompt,
  prompt,
  responseSchema,
  model = "gemini-2.5-flash",
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
