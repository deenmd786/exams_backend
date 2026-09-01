// test-run.js
require('dotenv').config(); // Loads your .env variables (GitHub tokens, etc.)
const { runArticlesJob, runQuizzesJob } = require('./src/cron/dailyJob');

async function testPipeline() {
    console.log("🛠️ Starting Manual Test Pipeline...");

    try {
        console.log("\n➡️ STEP 1: Running Articles Job...");
        await runArticlesJob();
        console.log("✅ Articles Job completed.");

        console.log("\n➡️ STEP 2: Running Quizzes Job...");
        await runQuizzesJob();
        console.log("✅ Quizzes Job completed.");

        console.log("\n🎉 All tests finished successfully!");
        process.exit(0); // Exit the script successfully

    } catch (error) {
        console.error("\n❌ Test Pipeline Failed:", error);
        process.exit(1); // Exit with error
    }
}

// Execute the test
testPipeline();