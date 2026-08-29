const cron = require("node-cron");
const { fetchDailyArticles } = require("../services/newsService");
const { getExamWorthyArticles } = require("../services/curationService");
const { generateBatchQuizzes } = require("../services/quizService");
const { checkAndUpdateDualDatasets } = require("../services/updaterService");
const { readData, writeData } = require("../utils/fileHelper");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPipelineNow() {
    console.log("🚀 Starting Daily Current Affairs Pipeline...");

    try {
        // 1. Fetch raw candidate articles (from PIB, The Hindu, Google News)
        const rawArticles = await fetchDailyArticles(100);

        if (!rawArticles || rawArticles.length === 0) {
            console.log("⚠️ No articles fetched. Pipeline aborted.");
            return;
        }
        console.log(`📥 Fetched ${rawArticles.length} raw articles.`);

        // 2. Filter down to top 5 exam-worthy articles
        console.log("🔍 Filtering down to top 5 exam-worthy articles...");
        let curatedArticles = await getExamWorthyArticles(rawArticles, 5);

        if (!curatedArticles || curatedArticles.length === 0) {
            console.log("⚠️ Curation returned 0 articles. Falling back to top 5 raw articles.");
            curatedArticles = rawArticles.slice(0, 5);
        }
        console.log(`✅ Selected ${curatedArticles.length} high-yield articles.`);

        // 3. Format Date & Monthly File Path
        const now = new Date();
        const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const monthName = now.toLocaleString("default", { month: "long" }).toLowerCase();
        const year = now.getFullYear();
        const newsFileName = `news/${monthName}_${year}.json`;

        // 4. Save the 5 articles to monthly archive (overwrites today's entry if re-tested)
        let monthlyNews = await readData(newsFileName);
        if (!Array.isArray(monthlyNews)) {
            monthlyNews = [];
        }

        const existingDayIndex = monthlyNews.findIndex((entry) => entry.date === today);
        const dailyEntry = {
            date: today,
            total_articles: curatedArticles.length,
            articles: curatedArticles
        };

        if (existingDayIndex >= 0) {
            monthlyNews[existingDayIndex] = dailyEntry;
            console.log(`🔄 Updated existing record for ${today} in data/${newsFileName}`);
        } else {
            monthlyNews.push(dailyEntry);
            console.log(`📁 Added new entry for ${today} to data/${newsFileName}`);
        }

        await writeData(newsFileName, monthlyNews);

        // 5. Generate exactly 5 MCQs (1 per curated article)
        console.log(`📰 Generating batch quizzes for ${curatedArticles.length} articles...`);
        const createdQuizzes = await generateBatchQuizzes(curatedArticles);
        console.log(`🎯 Generated ${createdQuizzes.length} new unique quiz questions.`);

        // 6. Cross-reference ONLY the 5 curated articles with GitHub Dynamic GK datasets
        console.log("⏳ Syncing dynamic GitHub GK datasets for 5 curated articles...");
        for (const article of curatedArticles) {
            const combinedText = `${article.title}. ${article.description}`;
            await checkAndUpdateDualDatasets(combinedText);
        }

        console.log("✅ Daily sync pipeline completed successfully!");
    } catch (error) {
        console.error("❌ Pipeline failed with error:", error.message);
    }
}

function startDailyJobs() {
    cron.schedule("0 6 * * *", async () => {
        console.log("⏰ 6:00 AM Cron Triggered!");
        await runPipelineNow();
    });
    console.log("⏱️ Cron job scheduled for 6:00 AM daily.");
}

module.exports = { startDailyJobs, runPipelineNow };