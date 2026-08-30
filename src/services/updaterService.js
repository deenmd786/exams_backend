const { updaterModel: model } = require("../config/ai"); // ✅ Uses your dedicated updater key
const { getFileFromGithub, updateFileOnGithub } = require("./githubService");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ✅ Added 'strategy' to guide the AI on Append vs Update
const PAIRED_DATASETS = [
    {
        name: "Chief Ministers and Governors",
        enPath: "Dynamic_GK_Lists/English/Chief_Ministers_and_Governors.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Chief_Ministers_and_Governors.json",
        strategy: "UPDATE the existing state's entry. Do not append."
    },
    {
        name: "Global Indexes and Rankings",
        enPath: "Dynamic_GK_Lists/English/Global_Indexes_and_Rankings.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Global_Indexes_and_Rankings.json",
        strategy: "UPDATE the existing index ranking for the current year."
    },
    {
        name: "Government Schemes",
        enPath: "Dynamic_GK_Lists/English/Government_Schemes.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Government_Schemes.json",
        strategy: "APPEND the new scheme to the array as a new object."
    },
    {
        name: "Important Appointments 2026",
        enPath: "Dynamic_GK_Lists/English/Important_Appointments_2026.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Important_Appointments_2026.json",
        strategy: "APPEND the new appointment to the array."
    },
    {
        name: "International Heads and Orgs",
        enPath: "Dynamic_GK_Lists/English/International_Heads_and_Orgs.json",
        hiPath: "Dynamic_GK_Lists/Hindi/International_Heads_and_Orgs.json",
        strategy: "UPDATE the existing organization's head."
    },
    {
        name: "Joint Military Exercises",
        enPath: "Dynamic_GK_Lists/English/Joint_Military_Exercises.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Joint_Military_Exercises.json",
        strategy: "APPEND the new military exercise event to the array."
    },
    {
        name: "RBI Rates and Indexes",
        enPath: "Dynamic_GK_Lists/English/RBI_Rates_and_Indexes.json",
        hiPath: "Dynamic_GK_Lists/Hindi/RBI_Rates_and_Indexes.json",
        strategy: "UPDATE the existing rate values (e.g., Repo Rate) in place."
    },
    {
        name: "Sports Champions and Venues",
        enPath: "Dynamic_GK_Lists/English/Sports_Champions_and_Venues.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Sports_Champions_and_Venues.json",
        strategy: "APPEND the new sports tournament winner/venue to the array."
    },
    {
        name: "Who's Who Cabinet Ministers",
        enPath: "Dynamic_GK_Lists/English/Whos_Who_Cabinet_Ministers.json",
        hiPath: "Dynamic_GK_Lists/Hindi/Whos_Who_Cabinet_Ministers.json",
        strategy: "UPDATE the existing ministry's minister name."
    }
];

/**
 * AI ROUTER: Identifies which datasets (if any) need to be updated based on the news
 */
async function identifyRelevantDatasets(headlineText) {
    const datasetNames = PAIRED_DATASETS.map(d => d.name);

    const prompt = `
    You are an intelligent data router for Indian Competitive Exam datasets.
    Read the following news text:
    "${headlineText}"

    Which of these exact dataset categories does this news affect?
    ${JSON.stringify(datasetNames, null, 2)}

    Rules:
    - If it's a new scheme, output ["Government Schemes"].
    - If it's a sports winner, output ["Sports Champions and Venues"].
    - If it doesn't fit any category, output an empty array: [].
    
    Return ONLY a valid JSON array of strings matching the exact names above. Do not include markdown or backticks.
    `;

    try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim().replace(/```json/gi, "").replace(/```/g, "");
        const matchedNames = JSON.parse(rawText);

        // Filter our datasets array to only return the ones the AI selected
        return PAIRED_DATASETS.filter(d => matchedNames.includes(d.name));
    } catch (error) {
        console.error("❌ Failed to route headline to datasets:", error.message);
        return [];
    }
}

/**
 * MAIN UPDATER: Only processes the specific files triggered by the router
 */
async function checkAndUpdateDualDatasets(headlineText) {
    // 1. Ask the AI Router which files to check
    const targetedDatasets = await identifyRelevantDatasets(headlineText);

    if (targetedDatasets.length === 0) {
        console.log(`⏩ No dynamic dataset updates triggered for: "${headlineText.slice(0, 50)}..."`);
        return;
    }

    console.log(`🎯 Headline triggered updates for: ${targetedDatasets.map(d => d.name).join(", ")}`);

    // 2. Iterate ONLY over the targeted datasets
    for (const pair of targetedDatasets) {
        const enFile = await getFileFromGithub(pair.enPath);
        const hiFile = await getFileFromGithub(pair.hiPath);

        if (!enFile || !hiFile) {
            console.log(`⚠️ Skipping ${pair.name} - File not found on GitHub.`);
            continue;
        }

        const today = new Date().toISOString().split("T")[0];

        const prompt = `
        You are an automated current affairs synchronization assistant.
        News Headline: "${headlineText}"
        
        Current English Dataset (${pair.name}):
        ${JSON.stringify(enFile.json)}

        Current Hindi Dataset (${pair.name}):
        ${JSON.stringify(hiFile.json)}

        CRITICAL INSTRUCTION FOR THIS DATASET:
        **${pair.strategy}**

        Instructions:
        1. Apply the news update to both English and Hindi JSON arrays based on the strategy above.
        2. Ensure authentic Hindi translations for names, designations, and statuses in the Hindi object.
        3. Include a "last_updated": "${today}" flag.
        4. If NO changes logically apply upon reading the data, respond ONLY with the exact text "NO_CHANGE".

        Return format (strictly raw JSON, no markdown formatting):
        {
          "en": { ...full updated English JSON... },
          "hi": { ...full updated Hindi JSON... }
        }
        `;

        try {
            const result = await model.generateContent(prompt);
            let rawText = result.response.text().trim();

            if (rawText !== "NO_CHANGE") {
                rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(rawText);

                if (parsed.en && parsed.hi) {
                    await updateFileOnGithub(pair.enPath, parsed.en, enFile.sha, `Auto-update (EN): ${pair.name} - ${today}`);
                    await updateFileOnGithub(pair.hiPath, parsed.hi, hiFile.sha, `Auto-update (HI): ${pair.name} - ${today}`);
                    console.log(`✅ Successfully synced ${pair.name} to GitHub.`);
                }
            } else {
                console.log(`[-] AI verified no changes needed for: ${pair.name}`);
            }
        } catch (error) {
            console.error(`❌ Error updating pair ${pair.name}:`, error.message);
        }

        // ⏳ Cooldown between updates to protect GitHub & Gemini Quotas
        console.log(`⏳ Cooling down for 15 seconds after checking ${pair.name}...`);
        await sleep(15000);
    }
}

module.exports = { checkAndUpdateDualDatasets };