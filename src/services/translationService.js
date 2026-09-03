const { generateWithRetryAndFallback, curationKey } = require('../config/ai');

/**
 * Translates an array of curated articles into Hindi via Gemini in one batch call
 */
async function translateArticlesToHindi(articles) {
    if (!articles || articles.length === 0) return [];
    console.log(`🌐 Batch-translating ${articles.length} articles to Hindi via Gemini...`);

    const prompt = `
You are an expert Hindi translator for Indian Competitive Exam news content.
Translate the following array of news articles into natural, formal Hindi (Devanagari script).

Requirements:
1. Translate the "title" and "description" fields accurately into Hindi.
2. Keep "source" and "link" fields EXACTLY identical (do not alter URLs or publishers).
3. Output strictly a valid JSON array matching the original schema.

Articles to Translate:
${JSON.stringify(articles, null, 2)}

Return ONLY valid raw JSON array (no markdown code blocks, no backticks):
`;

    try {
        const result = await generateWithRetryAndFallback(prompt, curationKey);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const match = rawText.match(/\[[\s\S]*\]/);
        const jsonStr = match ? match[0] : rawText;
        const translatedArticles = JSON.parse(jsonStr);

        console.log(`✅ Successfully translated ${translatedArticles.length} articles to Hindi with AI.`);
        return translatedArticles;
    } catch (error) {
        console.error("❌ Batch AI article translation failed, returning original articles:", error.message);
        return articles;
    }
}

/**
 * Translates all quizzes in a single Gemini API call
 */
async function translateQuizzesToHindi(quizzes) {
    if (!quizzes || quizzes.length === 0) return [];
    console.log(`🌐 Batch-translating ${quizzes.length} quizzes to Hindi via Gemini...`);

    const prompt = `
You are an expert Hindi translator for Indian Competitive Exam questions.
Translate the following array of quiz objects into natural, formal Hindi (Devanagari script).

Requirements:
1. Translate "question", "options" array, "answer", and "explanation" to Hindi.
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
        console.error("❌ Batch AI quiz translation failed, returning original quizzes:", error.message);
        return quizzes;
    }
}

/**
 * Single-string fallback translator (exported for compatibility)
 */
async function translateText(text) {
    if (!text || typeof text !== 'string') return text || "";
    try {
        const prompt = `Translate this text into formal Hindi (Devanagari script). Return ONLY the translated string without quotes or notes:\n\n${text}`;
        const result = await generateWithRetryAndFallback(prompt, curationKey);
        return result.response.text().trim() || text;
    } catch (e) {
        return text;
    }
}

module.exports = {
    translateText,
    translateArticlesToHindi,
    translateQuizzesToHindi
};