const express = require('express');
require('dotenv').config();
const { runPipelineNow } = require('./src/cron/dailyJob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Basic health route
app.get('/api/health', (req, res) => {
    res.json({ status: "Active", timestamp: new Date() });
});

// ⏰ 5:00 AM Automated Trigger Endpoint (with secret protection)
app.get('/api/trigger-sync', async (req, res) => {
    const clientSecret = req.query.secret;
    const expectedSecret = process.env.CRON_SECRET || "my_sync_secret_2026";

    if (clientSecret !== expectedSecret) {
        return res.status(401).json({ error: "Unauthorized: Invalid secret key" });
    }

    // Acknowledge the HTTP request immediately so the external cron doesn't timeout
    res.json({ message: "5:00 AM Sync pipeline initiated in the background!" });

    // Execute the complete sync pipeline
    console.log("⏰ 5:00 AM Sync Trigger Received!");
    await runPipelineNow();
});

// Manual test endpoint (for local development)
app.get('/api/test-sync', async (req, res) => {
    res.json({ message: "Test sync initiated in the background! Check console logs." });
    await runPipelineNow();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`👉 Test locally at: http://localhost:${PORT}/api/test-sync`);
});