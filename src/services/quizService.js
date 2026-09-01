const { generateWithRetryAndFallback, quizKey } = require('../config/ai');
const { readData, writeData } = require('../utils/fileHelper');

async function generateBatchQuizzes(articles) {
    if (!articles || articles.length === 0) return [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    let existingQuizzes = await readData('quizzes.json').catch(() => []);
    let currentCount = existingQuizzes.length;
    const existingQuestionsText = existingQuizzes.map(q => q.question.toLowerCase());

    // Prepare payload with an explicit ID so we can map links back accurately
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
    1. Each question must test a factual detail from its respective news description.
    2. Provide 4 distinct options per question.
    3. "answer" must match one option string exactly.
    4. Provide a clear 1-2 sentence explanation citing facts from the description.
    5. VERY IMPORTANT: You must include the "article_index" so I know which news item this quiz belongs to.
    6. The entire quiz (questions, options, answers, explanations) MUST be written in strict English.
    
    Output strictly a JSON Array of objects matching this schema:
    [
      {
        "article_index": Number,
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "Option A",
        "explanation": "Explanation text",
        "tags": ["Category1", "Category2"]
      }
    ]
    Return ONLY valid raw JSON without markdown code blocks.
    `;

    try {
        // Updated to use the resilient retry and fallback system
        const result = await generateWithRetryAndFallback(prompt, quizKey);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        const generatedList = JSON.parse(rawText);
        const newQuizzes = [];

        for (const quiz of generatedList) {
            if (existingQuestionsText.includes(quiz.question.toLowerCase())) {
                console.log(`[-] Skipping duplicate question: "${quiz.question}"`);
                continue;
            }

            currentCount++;
            const id = `ca_${year}_${month}_${String(currentCount).padStart(3, '0')}`;

            // Map the source and link from the original array using the returned index
            const originalArticle = articles[quiz.article_index];

            const formattedQuiz = {
                id: id,
                date: today,
                question: quiz.question,
                options: quiz.options,
                answer: quiz.answer,
                explanation: quiz.explanation,
                tags: quiz.tags || ["Current Affairs"],
                source: originalArticle ? originalArticle.source : "Unknown",
                link: originalArticle ? originalArticle.link : ""
            };

            newQuizzes.push(formattedQuiz);
            existingQuestionsText.push(quiz.question.toLowerCase());
        }

        if (newQuizzes.length > 0) {
            const updatedList = [...existingQuizzes, ...newQuizzes];
            await writeData('quizzes.json', updatedList);
            console.log(`✅ Successfully saved ${newQuizzes.length} unique quiz questions into data/quizzes.json`);
        }

        return newQuizzes;
    } catch (error) {
        console.error("Failed to generate batch quizzes:", error.message);
        return [];
    }
}

module.exports = { generateBatchQuizzes };