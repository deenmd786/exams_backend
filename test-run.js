// test-run.js
require('dotenv').config();
const { getFileFromGithub, CURRENT_AFFAIRS_REPO } = require('./src/services/githubService');
const { syncQuizzesToGithub, getISTDateString } = require('./src/services/githubCurrentAffairsService');
const { translateQuizzesToHindi } = require('./src/services/translationService');

async function syncHindiQuizzesFromEnglish() {
    console.log("🛠️ Starting English-to-Hindi Quiz Sync...");

    try {
        const todayStr = typeof getISTDateString === 'function'
            ? getISTDateString()
            : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const year = now.getFullYear();
        const monthNum = String(now.getMonth() + 1).padStart(2, '0');
        const monthName = now.toLocaleString("en-US", { month: 'long', timeZone: 'Asia/Kolkata' });

        const englishQuizPath = `${year}/Quiz/English/${monthNum}_${monthName}_${year}.json`;
        console.log(`📥 Fetching English quizzes from GitHub: ${englishQuizPath}`);

        // 1. Fetch the English quiz file from GitHub
        const enFile = await getFileFromGithub(englishQuizPath, CURRENT_AFFAIRS_REPO);
        if (!enFile || !Array.isArray(enFile.json)) {
            throw new Error(`Failed to load English quiz data from path: ${englishQuizPath}`);
        }

        // 2. Filter quizzes created for today
        const todayQuizzes = enFile.json.filter(q => q.date === todayStr);
        if (todayQuizzes.length === 0) {
            throw new Error(`No quizzes found for date [${todayStr}] inside ${englishQuizPath}`);
        }

        console.log(`🔍 Found ${todayQuizzes.length} English quizzes for date: ${todayStr}`);

        // 3. Batch-translate the quizzes to Hindi using Gemini Flash
        console.log("🌐 Translating quizzes to Hindi...");
        const hindiQuizzes = await translateQuizzesToHindi(todayQuizzes);

        // 4. Update the Hindi quiz file on GitHub
        console.log("📤 Uploading translated quizzes to GitHub...");
        await syncQuizzesToGithub(hindiQuizzes, 'Hindi');

        console.log(`🎉 Successfully updated Hindi quizzes on GitHub for [${todayStr}]!`);
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Quiz Sync Failed:", error.message || error);
        process.exit(1);
    }
}

// Execute
syncHindiQuizzesFromEnglish();