const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getEphemeralToken() {

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const token = await client.authTokens.create({
    config: {
      expireTime, // Default 1 minute in the future
      newSessionExpireTime: new Date(Date.now() + (1 * 60 * 1000)),
      httpOptions: {apiVersion: 'v1alpha'},
    },
  });

  return token;
}

module.exports = { getEphemeralToken };
