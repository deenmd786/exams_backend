const express = require('express');
require('dotenv').config();
const {
    runArticlesJob,
    runQuizzesJob,
    runDynamicGkJob,
    runPipelineNow
} = require('./src/cron/dailyJob');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. Root route to display server status and available endpoints
app.get('/', (req, res) => {
    const secret = process.env.CRON_SECRET || "my_sync_secret_2026";
    res.json({
        status: "Online",
        message: "Current Affairs & Quiz Task Runner is active.",
        endpoints: {
            health: "/api/health",
            ping: "/ping",
            autoTask: `/api/run-task?secret=${secret}`,
            runArticles: `/api/run-task?secret=${secret}&task=articles`,
            runQuizzes: `/api/run-task?secret=${secret}&task=quizzes`,
            runDynamicGK: `/api/run-task?secret=${secret}&task=gk&index=0`,
            testSyncFull: "/api/test-sync"
        }
    });
});

// 2. Health & Wake-up routes
app.get('/api/health', (req, res) => {
    res.json({ status: "Active", timestamp: new Date() });
});

app.get('/ping', (req, res) => {
    console.log('Ping received! Keeping server awake.');
    res.status(200).send('Awake');
});

// 3. Smart Dynamic Task Endpoint
app.get('/api/run-task', (req, res) => {
    const { secret, task, index } = req.query;
    const expectedSecret = process.env.CRON_SECRET || "my_sync_secret_2026";

    if (!secret || secret !== expectedSecret) {
        return res.status(401).json({ error: "Unauthorized: Invalid secret key" });
    }

    // Acknowledge immediately to prevent caller timeouts
    res.status(202).json({ message: "Task request received. Running in background." });

    (async () => {
        try {
            // 1. Manual Override (if task param is provided)
            if (task === 'articles') return await runArticlesJob();
            if (task === 'quizzes') return await runQuizzesJob();
            if (task === 'gk' && index !== undefined) return await runDynamicGkJob(parseInt(index, 10));

            // 2. Automatic Time-Based Dispatcher (IST Timezone)
            const now = new Date();
            const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            const currentHour = istTime.getHours();

            console.log(`⏰ [Auto Task] Current IST Hour: ${currentHour}:30`);

            switch (currentHour) {
                case 3:
                    console.log("🚀 [Auto Task] 3:30 AM IST -> Generating Daily Articles...");
                    await runArticlesJob();
                    break;
                case 5:
                    console.log("🚀 [Auto Task] 5:30 AM IST -> Generating Daily Quizzes...");
                    await runQuizzesJob();
                    break;
                case 7:
                case 9:
                case 11:
                case 13:
                case 15:
                case 17:
                case 19:
                case 21:
                case 23: {
                    // Maps 7->0, 9->1, 11->2, 13->3, 15->4, 17->5, 19->6, 21->7, 23->8
                    const gkIndex = (currentHour - 7) / 2;
                    console.log(`🚀 [Auto Task] ${currentHour}:30 IST -> Fact-checking Dynamic GK Index ${gkIndex}...`);
                    await runDynamicGkJob(gkIndex);
                    break;
                }
                default:
                    console.log(`ℹ️ [Auto Task] No scheduled task for IST hour ${currentHour}. Server remains idle.`);
                    break;
            }
        } catch (error) {
            console.error("❌ Background auto-task failed:", error.message);
        }
    })();
});

// 4. Local testing route (Runs full sync with log output)
app.get('/api/test-sync', async (req, res) => {
    res.json({ message: "Test sync initiated in background. Check terminal logs." });
    try {
        await runPipelineNow();
    } catch (error) {
        console.error("❌ Local test sync failed:", error.message);
    }
});

// 5. Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({
        error: "Not Found",
        message: `The path '${req.originalUrl}' does not exist on this server.`
    });
});

app.listen(PORT, () => {
    const secret = process.env.CRON_SECRET || "my_sync_secret_2026";
    console.log(`Server running on port ${PORT}`);
    console.log(`👉 Test Auto Task: http://localhost:${PORT}/api/run-task?secret=${secret}`);
});