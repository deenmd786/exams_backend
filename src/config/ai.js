const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Collect all unique available keys into a fallback pool
const ALL_KEYS = [
    process.env.GEMINI_CURATION_KEY,
    process.env.GEMINI_QUIZ_KEY,
    process.env.GEMINI_UPDATER_KEY,
    process.env.GEMINI_API_KEY
].filter((key, idx, arr) => key && arr.indexOf(key) === idx);

// Individual dedicated clients
const curationKey = process.env.GEMINI_CURATION_KEY || ALL_KEYS[0];
const quizKey = process.env.GEMINI_QUIZ_KEY || ALL_KEYS[1] || ALL_KEYS[0];
const updaterKey = process.env.GEMINI_UPDATER_KEY || ALL_KEYS[2] || ALL_KEYS[0];

const curationAI = new GoogleGenerativeAI(curationKey);
const primaryAI = new GoogleGenerativeAI(quizKey);
const updaterAI = new GoogleGenerativeAI(updaterKey);

const curationModel = curationAI.getGenerativeModel({ model: "gemini-3.6-flash" });
const primaryModel = primaryAI.getGenerativeModel({ model: "gemini-3.6-flash" });
const updaterModel = updaterAI.getGenerativeModel({ model: "gemini-3.6-flash" });

/**
 * Universal Gemini caller with exponential backoff and fallback key rotation
 * @param {string|object} prompt - The prompt to send
 * @param {string} preferredKey - Optional specific key to try first
 * @param {number} maxRetriesPerKey - Retries per individual key (default: 3)
 */
async function generateWithRetryAndFallback(prompt, preferredKey = null, maxRetriesPerKey = 2) {
    // Order keys: preferred key first, followed by remaining pool
    const keyQueue = preferredKey
        ? [preferredKey, ...ALL_KEYS.filter(k => k !== preferredKey)]
        : [...ALL_KEYS];

    let lastError = null;

    for (let kIdx = 0; kIdx < keyQueue.length; kIdx++) {
        const currentKey = keyQueue[kIdx];
        const client = new GoogleGenerativeAI(currentKey);
        const model = client.getGenerativeModel({ model: "gemini-3.6-flash" });

        let delayMs = 3000;

        for (let attempt = 1; attempt <= maxRetriesPerKey; attempt++) {
            try {
                const response = await model.generateContent(prompt);
                return response;
            } catch (error) {
                lastError = error;
                const errStr = (error.message || "").toLowerCase();
                const isRetryable = errStr.includes("503") ||
                    errStr.includes("429") ||
                    errStr.includes("high demand") ||
                    errStr.includes("quota") ||
                    errStr.includes("service unavailable");

                if (isRetryable) {
                    console.warn(`⚠️ [Key ${kIdx + 1}/${keyQueue.length}] Attempt ${attempt} failed (${error.message}). Backing off ${delayMs / 1000}s...`);
                    await new Promise(res => setTimeout(res, delayMs));
                    delayMs *= 2; // 3s -> 6s -> 12s
                } else {
                    // Non-retryable error (e.g., prompt formatting), break retry loop to test next key
                    break;
                }
            }
        }
        console.warn(`🔄 Switching to next available API key in pool...`);
    }

    throw new Error(`All Gemini API keys and retries exhausted. Last error: ${lastError?.message}`);
}

module.exports = {
    curationModel,
    primaryModel,
    updaterModel,
    curationKey,
    quizKey,
    updaterKey,
    generateWithRetryAndFallback
};