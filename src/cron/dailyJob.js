const { fetchDailyArticles } = require("../services/newsService");
const { getExamWorthyArticles } = require("../services/curationService");
const { generateBatchQuizzes } = require("../services/quizService");
const { checkAndUpdateDualDatasets } = require("../services/updaterService");
const { readData, writeData } = require("../utils/fileHelper");
const { sendDailyAlert } = require("../services/alertService");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPipelineNow() {
    console.log("🚀 Starting Daily Current Affairs Pipeline...");
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    try {
        // 1. Fetch raw candidate articles
        const rawArticles = await fetchDailyArticles(100);
        if (!rawArticles || rawArticles.length === 0) {
            throw new Error("No raw articles fetched from RSS feeds.");
        }

        // 2. Curation Filter (Top 5)
        let curatedArticles = await getExamWorthyArticles(rawArticles, 5);
        if (!curatedArticles || curatedArticles.length === 0) {
            curatedArticles = rawArticles.slice(0, 5);
        }

        // 3. Save to monthly JSON archive
        const monthName = now.toLocaleString("default", { month: "long" }).toLowerCase();
        const year = now.getFullYear();
        const newsFileName = `news/${monthName}_${year}.json`;

        let monthlyNews = await readData(newsFileName);
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

        // 4. Generate batch quizzes
        const createdQuizzes = await generateBatchQuizzes(curatedArticles);

        // 5. Cooldown before GitHub Sync
        console.log("⏳ Cooling down 15s before syncing GitHub datasets...");
        await sleep(15000);

        // 6. Cross-reference with GitHub GK datasets
        for (const article of curatedArticles) {
            const combinedText = `${article.title}. ${article.description}`;
            await checkAndUpdateDualDatasets(combinedText);
        }

        console.log("✅ Daily sync pipeline completed successfully!");

        // 7. Dispatch Success Alert
        await sendDailyAlert({
            success: true,
            date: today,
            articlesCount: curatedArticles.length,
            quizzesCount: createdQuizzes.length
        });

        return { success: true, count: curatedArticles.length };

    } catch (error) {
        console.error("❌ Pipeline failed:", error.message);

        // Dispatch Failure Alert
        await sendDailyAlert({
            success: false,
            date: today,
            error: error.message
        });

        return { success: false, error: error.message };
    }
}

module.exports = { runPipelineNow };