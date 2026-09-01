const { fetchDailyArticles } = require("../services/newsService");
const { getExamWorthyArticles } = require("../services/curationService");
const { generateBatchQuizzes } = require("../services/quizService");
const { verifyAndUpdateSingleDataset } = require("../services/updaterService");
const { sendDailyAlert } = require("../services/alertService");
const { syncArticlesToGithub, syncQuizzesToGithub } = require("../services/githubCurrentAffairsService");
const { translateArticlesToHindi, translateQuizzesToHindi } = require("../services/translationService");
const { getFileFromGithub, CURRENT_AFFAIRS_REPO } = require("../services/githubService");

const getTodayString = () => new Date().toISOString().split("T")[0];

// TASK 1: Run at 3:30 AM
async function runArticlesJob() {
    console.log("🚀 Starting 3:30 AM Task: Generate Articles...");
    const rawArticles = await fetchDailyArticles(100);
    let curatedArticles = await getExamWorthyArticles(rawArticles, 5);

    const hindiArticles = await translateArticlesToHindi(curatedArticles);

    await syncArticlesToGithub(curatedArticles, 'English');
    await syncArticlesToGithub(hindiArticles, 'Hindi');

    await sendDailyAlert({ success: true, date: getTodayString(), message: "3:30 AM Articles Generated & Synced" });
}

// TASK 2: Run at 5:30 AM
async function runQuizzesJob() {
    console.log("🚀 Starting 5:30 AM Task: Generate Quizzes...");

    // 1. Fetch today's articles directly from GitHub (Because server slept since 3:30 AM)
    const now = new Date();
    const year = now.getFullYear();
    const monthNum = String(now.getMonth() + 1).padStart(2, '0');
    const monthName = now.toLocaleString("default", { month: "long" });
    const articlePath = `${year}/Article/English/${monthNum}_${monthName}_${year}.json`;

    const ghFile = await getFileFromGithub(articlePath, CURRENT_AFFAIRS_REPO);
    if (!ghFile || !ghFile.json) throw new Error("Could not find today's articles on GitHub to generate quizzes.");

    const todayStr = getTodayString();
    const todayData = ghFile.json.find(item => item.date === todayStr);
    if (!todayData || !todayData.articles) throw new Error("No articles found for today's date on GitHub.");

    // 2. Generate and translate
    const createdQuizzes = await generateBatchQuizzes(todayData.articles);
    const hindiQuizzes = await translateQuizzesToHindi(createdQuizzes);

    await syncQuizzesToGithub(createdQuizzes, 'English');
    await syncQuizzesToGithub(hindiQuizzes, 'Hindi');

    await sendDailyAlert({ success: true, date: todayStr, message: "5:30 AM Quizzes Generated & Synced" });
}

// TASK 3: Run every 2 hours from 7:30 AM to 11:30 PM
async function runDynamicGkJob(fileIndex) {
    console.log(`🚀 Starting GK Fact-Check Task for File Index: ${fileIndex}...`);
    const result = await verifyAndUpdateSingleDataset(Number(fileIndex));
    console.log("✅ Task Complete:", result);
}

module.exports = { runArticlesJob, runQuizzesJob, runDynamicGkJob };