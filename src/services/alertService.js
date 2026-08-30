const axios = require('axios');
require('dotenv').config();

async function sendDailyAlert({ success, date, articlesCount, quizzesCount, error }) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

    const message = success
        ? `✅ *Current Affairs Sync Completed!*\n\n📅 *Date:* ${date}\n📰 *Articles Curated:* ${articlesCount}\n🎯 *Quizzes Generated:* ${quizzesCount}\n🔄 *GitHub GK Datasets:* Checked & Updated`
        : `❌ *Current Affairs Pipeline Failed!*\n\n📅 *Date:* ${date}\n⚠️ *Error:* ${error}`;

    // 1. Send to Telegram (if configured)
    if (telegramToken && telegramChatId) {
        try {
            await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                chat_id: telegramChatId,
                text: message,
                parse_mode: "Markdown"
            });
            console.log("📲 Telegram alert sent successfully.");
        } catch (err) {
            console.error("Failed to send Telegram alert:", err.message);
        }
    }

    // 2. Send to Discord Webhook (if configured)
    if (discordWebhook) {
        try {
            await axios.post(discordWebhook, { content: message });
            console.log("📲 Discord alert sent successfully.");
        } catch (err) {
            console.error("Failed to send Discord alert:", err.message);
        }
    }
}

module.exports = { sendDailyAlert };