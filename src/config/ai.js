const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Build named key definitions
const KEY_DEFINITIONS = [
    { name: "GEMINI_CURATION_KEY", key: process.env.GEMINI_CURATION_KEY },
    { name: "GEMINI_QUIZ_KEY", key: process.env.GEMINI_QUIZ_KEY },
    { name: "GEMINI_UPDATER_KEY", key: process.env.GEMINI_UPDATER_KEY },
    { name: "GEMINI_API_KEY", key: process.env.GEMINI_API_KEY }
].filter(item => Boolean(item.key));

// Deduplicate keys while keeping their primary names
const UNIQUE_KEYS = [];
const seenKeys = new Set();
for (const item of KEY_DEFINITIONS) {
    if (!seenKeys.has(item.key)) {
        seenKeys.add(item.key);
        UNIQUE_KEYS.push(item);
    }
}

// Named key exports
const curationKey = process.env.GEMINI_CURATION_KEY || UNIQUE_KEYS[0]?.key;
const quizKey = process.env.GEMINI_QUIZ_KEY || UNIQUE_KEYS[1]?.key || UNIQUE_KEYS[0]?.key;
const updaterKey = process.env.GEMINI_UPDATER_KEY || UNIQUE_KEYS[2]?.key || UNIQUE_KEYS[0]?.key;

/**
 * Masks an API key for safe console logging (e.g., AIzaSy...9xYz)
 */
function maskKey(keyStr) {
    if (!keyStr || keyStr.length < 8) return "INVALID_KEY";
    return `${keyStr.slice(0, 6)}...${keyStr.slice(-4)}`;
}

/**
 * Universal Gemini caller with key rotation, detailed logs, and retries
 */
async function generateWithRetryAndFallback(prompt, preferredKey = null, maxRetriesPerKey = 2) {
    if (UNIQUE_KEYS.length === 0) {
        throw new Error("❌ No Gemini API keys found in .env!");
    }

    // Prioritize preferred key if specified
    const orderedPool = preferredKey
        ? [
            ...UNIQUE_KEYS.filter(k => k.key === preferredKey),
            ...UNIQUE_KEYS.filter(k => k.key !== preferredKey)
        ]
        : [...UNIQUE_KEYS];

    let lastError = null;

    for (let i = 0; i < orderedPool.length; i++) {
        const { name, key } = orderedPool[i];
        const masked = maskKey(key);
        console.log(`🔑 [AI Router] Using Key [${i + 1}/${orderedPool.length}]: ${name} (${masked})`);

        const client = new GoogleGenerativeAI(key);
        const model = client.getGenerativeModel({ model: "gemini-3.6-flash" });

        let delayMs = 3000;

        for (let attempt = 1; attempt <= maxRetriesPerKey; attempt++) {
            try {
                const response = await model.generateContent(prompt);
                console.log(`✅ [AI Router] Success using ${name} (${masked})`);
                return response;
            } catch (error) {
                lastError = error;
                const errStr = (error.message || "").toLowerCase();

                const isRateLimitOrQuota = errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted");
                const isTransientError = errStr.includes("503") || errStr.includes("high demand") || errStr.includes("service unavailable");

                if (isRateLimitOrQuota) {
                    console.warn(`⚠️ [Quota / Rate Limit] Key ${name} exhausted. Immediate failover to next key...`);
                    break; // Skip further retries on this key, switch immediately
                }

                if (isTransientError && attempt < maxRetriesPerKey) {
                    console.warn(`⏳ [503 Spike] ${name} busy (attempt ${attempt}/${maxRetriesPerKey}). Retrying in ${delayMs / 1000}s...`);
                    await new Promise(res => setTimeout(res, delayMs));
                    delayMs *= 2;
                } else {
                    break;
                }
            }
        }

        if (i < orderedPool.length - 1) {
            console.log(`🔄 Switching to next backup key in pool...`);
        }
    }

    throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message}`);
}

module.exports = {
    curationKey,
    quizKey,
    updaterKey,
    generateWithRetryAndFallback
};