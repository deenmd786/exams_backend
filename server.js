const express = require('express');
require('dotenv').config();
const { startDailyJobs, runPipelineNow } = require('./src/cron/dailyJob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Cron Jobs (Waits for 6 AM)
startDailyJobs();

app.get('/api/health', (req, res) => {
    res.json({ status: "Active", timestamp: new Date() });
});

// 🚀 NEW: Manual trigger endpoint for testing!
app.get('/api/test-sync', async (req, res) => {
    // Respond immediately so the browser doesn't hang
    res.json({ message: "Sync pipeline initiated in the background! Check your terminal console for live logs." });

    // Run the AI pipeline
    await runPipelineNow();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`👉 To run a test immediately, open your browser and go to: http://localhost:${PORT}/api/test-sync`);
});