const { fetchDailyArticles } = require("../services/newsService");
const { getExamWorthyArticles } = require("../services/curationService");
const { generateBatchQuizzes } = require("../services/quizService");
const { verifyAndUpdateSingleDataset } = require("../services/updaterService");
const { sendDailyAlert } = require("../services/alertService");
const {
    syncArticlesToGithub,
    syncQuizzesToGithub,
    getISTDateString
} = require("../services/githubCurrentAffairsService");
const { translateArticlesToHindi, translateQuizzesToHindi } = require("../services/translationService");
const { readData, writeData } = require("../utils/fileHelper");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Safe IST Date string helper (YYYY-MM-DD)
const getTodayIST = () => {
    if (typeof getISTDateString === 'function') return getISTDateString();
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
};

/**
 * 5:30 AM Morning Pipeline:
 * Fetches fresh morning feeds, curates top 5, translates, pushes Articles (EN & HI),
 * immediately generates quizzes from memory, translates, and pushes Quizzes (EN & HI).
 */
async function runMorningPipelineJob() {
    const today = getTodayIST();
    console.log(`🚀 Starting 5:30 AM Morning Pipeline for IST date: [${today}]...`);

    try {
        // 1. Fetch fresh morning news
        const rawArticles = await fetchDailyArticles(100);
        if (!rawArticles || rawArticles.length === 0) {
            throw new Error("No raw articles fetched from RSS feeds.");
        }

        // 2. Curate Top 5 exam-worthy articles
        let curatedArticles = await getExamWorthyArticles(rawArticles, 5);
        if (!curatedArticles || curatedArticles.length === 0) {
            curatedArticles = rawArticles.slice(0, 5);
        }

        // 3. Local JSON archive backup
        const istDateObj = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const monthName = istDateObj.toLocaleString("default", { month: "long" }).toLowerCase();
        const year = istDateObj.getFullYear();
        const newsFileName = `news/${monthName}_${year}.json`;

        let monthlyNews = await readData(newsFileName).catch(() => []);
        if (!Array.isArray(monthlyNews)) monthlyNews = [];

        const existingDayIndex = monthlyNews.findIndex((entry) => entry.date === today);
        const dailyEntry = {
            date: today,
            total_articles: curatedArticles.length,
            articles: curatedArticles
        };

        if (existingDayIndex >= 0) {
            monthlyNews[existingDayIndex] = dailyEntry;
        } else {
            monthlyNews.push(dailyEntry);
        }
        await writeData(newsFileName, monthlyNews);

        // 4. Translate curated articles to Hindi
        const hindiArticles = await translateArticlesToHindi(curatedArticles);

        // 5. Commit English & Hindi articles to GitHub
        await syncArticlesToGithub(curatedArticles, 'English');
        await syncArticlesToGithub(hindiArticles, 'Hindi');
        console.log("✅ English and Hindi Articles successfully pushed to GitHub.");

        // 6. Cooldown to prevent API spikes
        console.log("⏳ Cooling down 15s before generating quizzes...");
        await sleep(15000);

        // 7. Generate Quizzes directly from today's curated articles in memory
        const createdQuizzes = await generateBatchQuizzes(curatedArticles);
        if (!createdQuizzes || createdQuizzes.length === 0) {
            throw new Error("Quiz generation returned empty list.");
        }

        // 8. Translate Quizzes to Hindi
        const hindiQuizzes = await translateQuizzesToHindi(createdQuizzes);

        // 9. Commit English & Hindi quizzes to GitHub
        await syncQuizzesToGithub(createdQuizzes, 'English');
        await syncQuizzesToGithub(hindiQuizzes, 'Hindi');
        console.log("✅ English and Hindi Quizzes successfully pushed to GitHub.");

        // 10. Success alert
        await sendDailyAlert({
            success: true,
            date: today,
            articlesCount: curatedArticles.length,
            quizzesCount: createdQuizzes.length,
            message: "5:30 AM Morning Pipeline (Articles + Quizzes EN/HI) completed successfully."
        });

        return { success: true, count: curatedArticles.length };

    } catch (error) {
        console.error("❌ Morning Pipeline failed:", error.message);
        await sendDailyAlert({
            success: false,
            date: today,
            error: error.message
        });
        throw error;
    }
}

/**
 * Dynamic GK Task: Fact-checks one file index at a time
 */
async function runDynamicGkJob(fileIndex) {
    console.log(`🚀 Starting GK Fact-Check Task for File Index: ${fileIndex}...`);
    const result = await verifyAndUpdateSingleDataset(Number(fileIndex));
    console.log("✅ Task Complete:", result);
    return result;
}

module.exports = {
    runMorningPipelineJob,
    runDynamicGkJob,
    runPipelineNow: runMorningPipelineJob // Backward compatibility alias
};