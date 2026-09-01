const { generateWithRetryAndFallback, quizKey } = require('../config/ai');
const { readData, writeData } = require('../utils/fileHelper');

/**
 * Generates MCQs for curated articles with index mapping and local backup
 */
async function generateBatchQuizzes(articles) {
    if (!articles || articles.length === 0) return [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    let existingQuizzes = await readData('quizzes.json').catch(() => []);
    if (!Array.isArray(existingQuizzes)) existingQuizzes = [];

    let currentCount = existingQuizzes.length;
    const existingQuestionsText = new Set(
        existingQuizzes.map(q => (q.question || "").toLowerCase().trim())
    );

    const articlesPayload = articles.map((a, i) => ({
        article_index: i,
        title: a.title,
        description: a.description
    }));

    const prompt = `
You are an expert exam content creator for competitive exams (UPSC, SSC, Banking).
Here are ${articles.length} news items:
${JSON.stringify(articlesPayload, null, 2)}

Task: Create EXACTLY ONE multiple-choice question for EACH news item.

Requirements:
1. Test a factual detail directly from the news description.
2. Provide exactly 4 distinct options per question.
3. "answer" must match one option string exactly.
4. Provide a 1-2 sentence explanation citing facts from the text.
5. Include "article_index" corresponding to the source item.
6. Write everything in clear English.

Output strictly a JSON Array of objects matching this schema:
[
  {
    "article_index": 0,
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A",
    "explanation": "Explanation text",
    "tags": ["Category1", "Category2"]
  }
]
Return ONLY valid raw JSON without markdown formatting.
`;

    try {
        const result = await generateWithRetryAndFallback(prompt, quizKey);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        const match = rawText.match(/\[[\s\S]*\]/);
        const jsonStr = match ? match[0] : rawText;
        const generatedList = JSON.parse(jsonStr);

        const newQuizzes = [];

        for (let i = 0; i < generatedList.length; i++) {
            const quiz = generatedList[i];
            const normalizedQuestion = (quiz.question || "").toLowerCase().trim();

            if (existingQuestionsText.has(normalizedQuestion)) {
                console.log(`[-] Skipping duplicate question: "${quiz.question}"`);
                continue;
            }

            currentCount++;
            const id = `ca_${year}_${month}_${String(currentCount).padStart(3, '0')}`;

            // Map original article source and link by index, with fallback to current loop index
            const targetIndex = Number.isInteger(quiz.article_index) ? quiz.article_index : i;
            const originalArticle = articles[targetIndex] || articles[i] || {};

            const formattedQuiz = {
                id: id,
                date: today,
                question: quiz.question,
                options: Array.isArray(quiz.options) ? quiz.options : [],
                answer: quiz.answer,
                explanation: quiz.explanation || "",
                tags: Array.isArray(quiz.tags) ? quiz.tags : ["Current Affairs"],
                source: originalArticle.source || "Current Affairs",
                link: originalArticle.link || ""
            };

            newQuizzes.push(formattedQuiz);
            existingQuestionsText.add(normalizedQuestion);
        }

        // Save local backup
        if (newQuizzes.length > 0) {
            try {
                const updatedList = [...existingQuizzes, ...newQuizzes];
                await writeData('quizzes.json', updatedList);
                console.log(`✅ Successfully saved ${newQuizzes.length} unique quiz questions into data/quizzes.json`);
            } catch (fsErr) {
                console.warn("⚠️ Local quiz backup write skipped:", fsErr.message);
            }
        }

        return newQuizzes;
    } catch (error) {
        console.error("❌ Failed to generate batch quizzes:", error.message);
        return [];
    }
}

module.exports = { generateBatchQuizzes };