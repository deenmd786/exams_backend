const axios = require('axios');
const { generateWithRetryAndFallback, curationKey } = require("../config/ai");

// Directly configure the repo and the NEW token for this specific job
const GK_REPO = "deenmd786/general_knowledge";
const GITHUB_TOKEN_2 = process.env.GITHUB_TOKEN_2;

const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        Authorization: `Bearer ${GITHUB_TOKEN_2}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Daily-Content-Service'
    }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns formatted date strings strictly in Indian Standard Time (IST)
 */
function getISTDateParts(dateObj = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const [dd, mm, yyyy] = formatter.format(dateObj).split('/');
    return {
        fileDate: `${dd}_${mm}_${yyyy}`,       // e.g., 05_09_2026
        displayDate: `${dd}-${mm}-${yyyy}`      // e.g., 05-09-2026
    };
}

/**
 * Helper to safely extract and parse JSON from AI response
 */
function parseCleanJson(text) {
    let cleaned = text.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error("AI did not return a valid JSON object structure.");
    }
    return JSON.parse(match[0]);
}

/**
 * Uploads file to GitHub using GITHUB_TOKEN_2
 */
async function pushToGithub(filePath, jsonData, commitMessage) {
    let existingSha = null;

    // 1. Check if file exists to get SHA
    try {
        const getResponse = await githubApi.get(`/repos/${GK_REPO}/contents/${filePath}`);
        existingSha = getResponse.data.sha;
    } catch (error) {
        if (error.response && error.response.status !== 404) {
            throw error;
        }
    }

    // 2. Upload file
    const formattedContent = Buffer.from(JSON.stringify(jsonData, null, 4), 'utf-8').toString('base64');
    const payload = {
        message: commitMessage,
        content: formattedContent
    };
    if (existingSha) payload.sha = existingSha;

    await githubApi.put(`/repos/${GK_REPO}/contents/${filePath}`, payload);
}

/**
 * Generates engaging daily content in Hindi (Devanagari)
 */
async function generateDailyContentHindi(displayDate) {
    console.log(`🌐 Generating Daily Content in Hindi for [${displayDate}]...`);

    const prompt = `
You are an expert educational content creator for Indian school students. 
Generate engaging daily educational content for today (${displayDate}) strictly in Hindi (Devanagari script).

Requirements for JSON keys:
1. "paheli": A clever, kid-friendly riddle with its answer.
2. "joke": A clean, funny school/family joke with named characters (e.g., "टीचर - स्टूडेंट", "पिता - पुत्र", "सांता - बंता"). Use an array of strings for "dialogue".
3. "prerak_kahani": A short, inspiring story (1 concise paragraph) with a clear "moral".
4. "word_of_the_day": An English word, its Hindi "meaning", and a Hindi "example" sentence.
5. "today_in_history": A memorable historical event that took place on this day or month.
6. "did_you_know": A fascinating science, nature, or general knowledge fact.
7. "quote_of_the_day": An inspiring quote with its "author".

Return STRICTLY a raw JSON object with this exact schema (no markdown formatting, no backticks):
{
  "date": "${displayDate}",
  "daily_content": {
    "paheli": { "icon": "🤔", "question": "", "answer": "" },
    "joke": { "icon": "😂", "characters": "", "dialogue": [] },
    "prerak_kahani": { "icon": "📖", "title": "", "story": "", "moral": "" },
    "word_of_the_day": { "icon": "📚", "word": "", "meaning": "", "example": "" },
    "today_in_history": { "icon": "🏛️", "fact": "" },
    "did_you_know": { "icon": "💡", "fact": "" },
    "quote_of_the_day": { "icon": "✨", "quote": "", "author": "" }
  }
}
`;

    const result = await generateWithRetryAndFallback(prompt, curationKey);
    return parseCleanJson(result.response.text());
}

/**
 * Translates Hindi Daily Content into natural English
 */
async function translateDailyContentToEnglish(hindiJson) {
    console.log(`🌐 Translating Daily Content to English via AI...`);

    const prompt = `
You are an expert translator and educator. Translate the content values of the following JSON from Hindi to natural English for students.

CRITICAL INSTRUCTIONS:
1. Keep all JSON keys exactly identical. Do not alter schema names.
2. Only translate the values (strings and arrays).
3. Ensure the riddle (paheli) and joke make natural, humorous sense in English.
4. For "word_of_the_day", keep the English word, and provide its English meaning and an English example sentence.

Input JSON:
${JSON.stringify(hindiJson, null, 2)}

Return ONLY valid raw JSON (no markdown, no backticks):
`;

    const result = await generateWithRetryAndFallback(prompt, curationKey);
    return parseCleanJson(result.response.text());
}

/**
 * Main Runner Job
 */
async function runDailyContentJob() {
    if (!GITHUB_TOKEN_2) {
        throw new Error("GITHUB_TOKEN_2 is missing from environment variables!");
    }

    try {
        const { fileDate, displayDate } = getISTDateParts();
        console.log(`🚀 [Daily Content] Starting run for ${fileDate} on repo: ${GK_REPO}...`);

        // 1. Generate Hindi Content & Push
        const hindiData = await generateDailyContentHindi(displayDate);
        const hindiPath = `Daily_Content/Hindi/${fileDate}.json`;

        await pushToGithub(hindiPath, hindiData, `Update Daily Content (Hindi): ${fileDate}`);
        console.log(`✅ Hindi content pushed: ${hindiPath}`);

        // 2. Cooldown gap to prevent API rate limiting
        console.log("⏳ Cooling down 10 seconds before generating English translation...");
        await sleep(10000);

        // 3. Translate and Push English Content
        const englishData = await translateDailyContentToEnglish(hindiData);
        const englishPath = `Daily_Content/English/${fileDate}.json`;

        await pushToGithub(englishPath, englishData, `Update Daily Content (English): ${fileDate}`);
        console.log(`✅ English content pushed: ${englishPath}`);

        console.log(`🎉 [Daily Content] Completed successfully for ${fileDate}!`);
        return { success: true, date: fileDate };

    } catch (error) {
        console.error("❌ Daily Content Job failed:", error.message);
        if (error.response && error.response.data) {
            console.error("GitHub API Details:", error.response.data);
        }
        throw error;
    }
}

module.exports = { runDailyContentJob };