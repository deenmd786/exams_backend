const { fetchDailyArticles } = require("../services/newsService");
const { getExamWorthyArticles } = require("../services/curationService");
const { generateBatchQuizzes } = require("../services/quizService");
const { syncDynamicDatasets } = require("../services/updaterService");
const { readData, writeData } = require("../utils/fileHelper");
const { sendDailyAlert } = require("../services/alertService");
const { syncArticlesToGithub, syncQuizzesToGithub } = require("../services/githubCurrentAffairsService"); // ✅ Imported

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

        // 3. Save to local monthly JSON archive
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

        // 5. 🌐 UPLOAD TO GITHUB (Articles & Quizzes in deenmd786/current_affairs)
        console.log("🚀 Uploading Articles & Quizzes to GitHub Repository...");
        await syncArticlesToGithub(curatedArticles);
        await syncQuizzesToGithub(createdQuizzes);
        console.log("✅ Successfully synced Articles & Quizzes to GitHub!");

        // 6. Cooldown before GitHub GK List Sync
        console.log("⏳ Cooling down 15s before syncing dynamic GK datasets...");
        await sleep(15000);

        // 7. Cross-reference articles for GK lists (CMs, Schemes, Military, etc.)
        await syncDynamicDatasets(curatedArticles);

        console.log("✅ Daily sync pipeline completed successfully!");

        // 8. Dispatch Success Alert
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