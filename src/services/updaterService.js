// Change line 1 to:
const { updaterModel: model } = require('../config/ai');
const { getFileFromGithub, updateFileOnGithub } = require("./githubService");

// Helper function to pause execution and prevent API rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PAIRED_DATASETS = [
    {
        name: "Chief Ministers and Governors",
        enPath: "Dynamic_GK_Lists/English/Chief_Ministers_and_Governors.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Chief_Ministers_and_Governors.json",
    },
    {
        name: "Global Indexes and Rankings",
        enPath: "Dynamic_GK_Lists/English/Global_Indexes_and_Rankings.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Global_Indexes_and_Rankings.json",
    },
    {
        name: "Government Schemes",
        enPath: "Dynamic_GK_Lists/English/Government_Schemes.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Government_Schemes.json",
    },
    {
        name: "Important Appointments 2026",
        enPath: "Dynamic_GK_Lists/English/Important_Appointments_2026.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Important_Appointments_2026.json",
    },
    {
        name: "International Heads and Orgs",
        enPath: "Dynamic_GK_Lists/English/International_Heads_and_Orgs.json",
        hiPath: "Dynamic_GK_Lists/Hindi/International_Heads_and_Orgs.json",
    },
    {
        name: "Joint Military Exercises",
        enPath: "Dynamic_GK_Lists/English/Joint_Military_Exercises.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Joint_Military_Exercises.json",
    },
    {
        name: "RBI Rates and Indexes",
        enPath: "Dynamic_GK_Lists/English/RBI_Rates_and_Indexes.json",
        hiPath: "Dynamic_GK_Lists/Hindi/RBI_Rates_and_Indexes.json",
    },
    {
        name: "Sports Champions and Venues",
        enPath: "Dynamic_GK_Lists/English/Sports_Champions_and_Venues.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Sports_Champions_and_Venues.json",
    },
    {
        name: "Who's Who Cabinet Ministers",
        enPath: "Dynamic_GK_Lists/English/Whos_Who_Cabinet_Ministers.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Whos_Who_Cabinet_Ministers.json",
    },
];

async function checkAndUpdateDualDatasets(headline) {
    for (const pair of PAIRED_DATASETS) {
        const enFile = await getFileFromGithub(pair.enPath);
        const hiFile = await getFileFromGithub(pair.hiPath);

        if (!enFile || !hiFile) {
            console.log(`⚠️ Skipping ${pair.name} - File not found on GitHub.`);
            continue;
        }

        const today = new Date().toISOString().split("T")[0];

        const prompt = `
    You are an automated current affairs synchronization assistant.
    News Headline: "${headline}"
    
    Current English Dataset (${pair.name}):
    ${JSON.stringify(enFile.json)}

    Current Hindi Dataset (${pair.name}):
    ${JSON.stringify(hiFile.json)}

    Instructions:
    1. Determine if this news headline modifies, updates, or adds new facts to this dataset.
    2. If YES, return both updated JSON objects with "last_updated": "${today}" and an informative "update_log" describing the exact update.
    3. Ensure authentic Hindi translations for names, designations, statuses, and logs in the Hindi object.
    4. If NO changes apply, respond ONLY with the exact text "NO_CHANGE".

    Return format (strictly raw JSON, no markdown formatting):
    {
      "en": { ...updated English JSON... },
      "hi": { ...updated Hindi JSON... }
    }
    `;

        try {
            const result = await model.generateContent(prompt);
            let rawText = result.response.text().trim();

            if (rawText !== "NO_CHANGE") {
                rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(rawText);

                if (parsed.en && parsed.hi) {
                    await updateFileOnGithub(
                        pair.enPath,
                        parsed.en,
                        enFile.sha,
                        `Auto-update (EN): ${pair.name} - ${today}`
                    );

                    await updateFileOnGithub(
                        pair.hiPath,
                        parsed.hi,
                        hiFile.sha,
                        `Auto-update (HI): ${pair.name} - ${today}`
                    );
                }
            } else {
                console.log(`[-] No updates needed for: ${pair.name}`);
            }
        } catch (error) {
            console.error(`❌ Error processing pair ${pair.name}:`, error.message);
        }

        // ✅ THE FIX: Wait 15 seconds before checking the next dataset!
        console.log(`⏳ Cooling down for 15 seconds after checking ${pair.name}...`);
        await sleep(15000);
    }
}

module.exports = { checkAndUpdateDualDatasets };