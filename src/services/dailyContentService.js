const { generateWithRetryAndFallback, curationKey } = require("../config/ai");
const { updateFileOnGithub } = require("./githubService");

const GK_REPO = process.env.GITHUB_GK_REPO || "deenmd786/general_knowledge";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: DD_MM_YYYY (e.g., 01_09_2026)
function getFormattedFileDate(dateObj = new Date()) {
    const istDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dd = String(istDate.getDate()).padStart(2, '0');
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const yyyy = istDate.getFullYear();
    return `${dd}_${mm}_${yyyy}`;
}

// Helper: DD-MM-YYYY (e.g., 01-09-2026)
function getStandardDisplayDate(dateObj = new Date()) {
    const istDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dd = String(istDate.getDate()).padStart(2, '0');
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const yyyy = istDate.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

async function generateDailyContentHindi(displayDate) {
    console.log(`🌐 Generating Daily Content in Hindi for [${displayDate}]...`);

    const prompt = `
You are an expert content creator for Indian school students. 
Generate engaging daily educational content for today (${displayDate}) strictly in Hindi (Devanagari script).

Requirements for JSON keys:
1. "paheli": A clever, kid-friendly riddle with its answer.
2. "joke": A funny, clean joke with character names (e.g., "टीचर - स्टूडेंट", "पिता - पुत्र", "सांता - बंता"). Use an array for "dialogue".
3. "prerak_kahani": A short, inspiring story (1 paragraph) with a clear "moral".
4. "word_of_the_day": An English word, its Hindi "meaning", and a Hindi "example" sentence.
5. "today_in_history": A significant historical fact for this day/month.
6. "did_you_know": A fascinating general knowledge fact.
7. "quote_of_the_day": An inspiring quote with its "author".

Return STRICTLY a raw JSON object with this exact schema (no markdown, no backticks):
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
    let rawText = result.response.text().trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = rawText.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : rawText);
}

async function translateDailyContentToEnglish(hindiJson) {
    console.log(`🌐 Translating Daily Content to English...`);
    const prompt = `
You are an expert translator. Translate the values in this JSON from Hindi to natural English.
CRITICAL:
1. Keep all JSON keys exactly unchanged.
2. Only translate string/array values.
3. Make sure the riddle and joke make natural sense in English.

Input JSON:
${JSON.stringify(hindiJson, null, 2)}

Return ONLY raw JSON (no markdown, no backticks):
`;

    const result = await generateWithRetryAndFallback(prompt, curationKey);
    let rawText = result.response.text().trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = rawText.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : rawText);
}

async function runDailyContentJob() {
    try {
        const fileDate = getFormattedFileDate();       // e.g. 01_09_2026
        const displayDate = getStandardDisplayDate();   // e.g. 01-09-2026

        console.log(`🚀 [Daily Content] Starting generation for ${fileDate} on repo ${GK_REPO}...`);

        // 1. Generate in Hindi
        const hindiData = await generateDailyContentHindi(displayDate);
        const hindiPath = `Daily_Content/Hindi/${fileDate}.json`;

        await updateFileOnGithub(
            hindiPath,
            hindiData,
            null,
            `Update Daily Content (Hindi): ${fileDate}`,
            GK_REPO
        );
        console.log(`✅ Hindi content pushed: ${hindiPath}`);

        // 2. Cooldown gap before calling translation AI
        console.log("⏳ Cooling down 10 seconds before translating to English...");
        await sleep(10000);

        // 3. Translate to English
        const englishData = await translateDailyContentToEnglish(hindiData);
        const englishPath = `Daily_Content/English/${fileDate}.json`;

        await updateFileOnGithub(
            englishPath,
            englishData,
            null,
            `Update Daily Content (English): ${fileDate}`,
            GK_REPO
        );
        console.log(`✅ English content pushed: ${englishPath}`);

        console.log(`🎉 [Daily Content] Complete for ${fileDate}!`);
        return { success: true, date: fileDate };

    } catch (error) {
        console.error("❌ Daily Content Job failed:", error.message);
        throw error;
    }
}

module.exports = { runDailyContentJob };