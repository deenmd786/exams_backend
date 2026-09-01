const { translate } = require('@vitalets/google-translate-api');

// 1. Helper function to create a delay (cool down)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely translates a single string to Hindi with an enforced cooldown
 */
async function translateText(text, delayMs = 1500) {
    if (!text || typeof text !== 'string') return text || "";

    try {
        const res = await translate(text, { to: 'hi' });
        // Enforce a cool down after a successful request to prevent 429 errors
        await sleep(delayMs);
        return res.text || text;
    } catch (error) {
        console.warn(`⚠️ Translation fallback for "${text.slice(0, 30)}...":`, error.message);

        // If we hit a rate limit (429), back off for 5 seconds before returning
        if (error.message.includes('429') || error.message.includes('TooManyRequestsError')) {
            console.warn("⏳ Rate limit hit! Forcing a 5-second backoff...");
            await sleep(5000);
        }

        return text;
    }
}

/**
 * Translates an array of curated articles into Hindi
 */
async function translateArticlesToHindi(articles) {
    console.log("🌐 Translating curated articles to Hindi...");
    const translatedArticles = [];

    for (const item of articles) {
        console.log(`   - Translating article: ${item.title?.slice(0, 20)}...`);
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
 * Translates an array of quizzes (questions, options, explanations) into Hindi
 */
async function translateQuizzesToHindi(quizzes) {
    console.log("🌐 Translating quizzes to Hindi...");
    const translatedQuizzes = [];

    for (const q of quizzes) {
        console.log(`   - Translating quiz ID: ${q.id}...`);
        const question_hi = await translateText(q.question);
        const explanation_hi = await translateText(q.explanation);

        // Translate each MCQ option sequentially
        const options_hi = [];
        if (Array.isArray(q.options)) {
            for (const opt of q.options) {
                options_hi.push(await translateText(opt));
            }
        }

        // Map correct answer to its translated equivalent
        let answer_hi = q.answer;
        if (Array.isArray(q.options) && q.options.includes(q.answer)) {
            const answerIndex = q.options.indexOf(q.answer);
            answer_hi = options_hi[answerIndex] || (await translateText(q.answer));
        } else {
            answer_hi = await translateText(q.answer);
        }

        translatedQuizzes.push({
            ...q,
            question: question_hi,
            options: options_hi,
            answer: answer_hi,
            explanation: explanation_hi
        });
    }

    return translatedQuizzes;
}

module.exports = {
    translateText,
    translateArticlesToHindi,
    translateQuizzesToHindi
};