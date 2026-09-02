const { translate } = require('@vitalets/google-translate-api');
const { generateWithRetryAndFallback, curationKey } = require('../config/ai');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely translates short article strings with delay
 */
async function translateText(text, delayMs = 1200) {
    if (!text || typeof text !== 'string') return text || "";
    try {
        const res = await translate(text, { to: 'hi' });
        await sleep(delayMs);
        return res.text || text;
    } catch (error) {
        console.warn(`⚠️ Translate fallback for "${text.slice(0, 25)}...":`, error.message);
        return text;
    }
}

/**
 * Translates 5 articles (only 10 total requests, which Google Translate easily allows)
 */
async function translateArticlesToHindi(articles) {
    console.log("🌐 Translating curated articles to Hindi...");
    const translatedArticles = [];

    for (const item of articles) {
        console.log(`   - Translating article: ${item.title?.slice(0, 25)}...`);
        const title_hi = await translateText(item.title);
        const description_hi = await translateText(item.description);

        translatedArticles.push({
            ...item,
            title: title_hi,
            description: description_hi
        });
    }

    return translatedArticles;
}

/**
 * Translates all quizzes in ONE single Gemini API call (Zero 429 Rate Limits)
 */
async function translateQuizzesToHindi(quizzes) {
    if (!quizzes || quizzes.length === 0) return [];
    console.log(`🌐 Batch-translating ${quizzes.length} quizzes to Hindi via Gemini...`);

    const prompt = `
You are an expert Hindi translator for Indian Competitive Exam questions.
Translate the following array of quiz objects into natural, formal Hindi (Devanagari script).

Requirements:
1. Translate "question", "options" array, "answer", and "explanation".
2. Keep "id", "date", "tags", "source", and "link" EXACTLY identical.
3. The translated "answer" must match one of the translated "options" strings exactly.
4. Output strictly a valid JSON array matching the original schema.

Quizzes to Translate:
${JSON.stringify(quizzes, null, 2)}

Return ONLY valid raw JSON array (no markdown code blocks, no backticks):
`;

    try {
        const result = await generateWithRetryAndFallback(prompt, curationKey);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const match = rawText.match(/\[[\s\S]*\]/);
        const jsonStr = match ? match[0] : rawText;
        const translatedQuizzes = JSON.parse(jsonStr);

        console.log(`✅ Successfully translated ${translatedQuizzes.length} quizzes to Hindi with AI.`);
        return translatedQuizzes;
    } catch (error) {
        console.error("❌ Batch AI quiz translation failed, falling back to original:", error.message);
        return quizzes;
    }
}

module.exports = {
    translateText,
    translateArticlesToHindi,
    translateQuizzesToHindi
};