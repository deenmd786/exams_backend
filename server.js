const express = require('express');
require('dotenv').config();
const { runPipelineNow } = require('./src/cron/dailyJob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. Root route to display server status and available endpoints
app.get('/', (req, res) => {
    res.json({
        status: "Online",
        message: "Current Affairs & Quiz Backend is running.",
        endpoints: {
            health: "/api/health",
            testSync: "/api/test-sync",
            triggerSync: "/api/trigger-sync?secret=" + (process.env.CRON_SECRET || "YOUR_SECRET")
        }
    });
});

// 2. Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: "Active", timestamp: new Date() });
});

// 3. 5:00 AM automated cron trigger endpoint
app.get('/api/trigger-sync', async (req, res) => {
    const clientSecret = req.query.secret;
    const expectedSecret = process.env.CRON_SECRET || "my_sync_secret_2026";

    if (!clientSecret || clientSecret !== expectedSecret) {
        return res.status(401).json({ error: "Unauthorized: Invalid or missing secret key" });
    }

    res.status(202).json({ message: "Sync pipeline initiated in background." });
    console.log("⏰ Sync trigger received. Starting pipeline...");
    await runPipelineNow();
});

// 4. Local testing trigger endpoint
app.get('/api/test-sync', async (req, res) => {
    res.json({ message: "Test sync initiated in background. Check terminal console." });
    await runPipelineNow();
});

// 5. Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({
        error: "Not Found",
        message: `The path '${req.originalUrl}' does not exist on this server.`,
        availableEndpoints: ["/", "/api/health", "/api/test-sync", "/api/trigger-sync"]
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`👉 Local Test: http://localhost:${PORT}/api/test-sync`);
});