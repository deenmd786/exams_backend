const { updaterModel: model } = require("../config/ai");
const { getFileFromGithub, updateFileOnGithub, CURRENT_AFFAIRS_REPO } = require("./githubService");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * BATCH AI ROUTER: Evaluates all 5 articles in ONE call
 */
async function identifyAllRelevantUpdates(articles) {
    const datasetNames = PAIRED_DATASETS.map(d => d.name);

    const prompt = `
    You are an intelligent data router for Indian Competitive Exam datasets.
    Here are today's curated news items:
    ${JSON.stringify(articles.map((a, i) => ({ id: i, text: `${a.title}. ${a.description}` })), null, 2)}

    Available Datasets:
    ${JSON.stringify(datasetNames, null, 2)}

    Task: Match any news item to its affected dataset.
    Rules:
    - If a news item updates or adds to a dataset, map the datasetName to the relevant news text.
    - If no news items affect a dataset, omit it.

    Return format (strictly raw JSON array of objects, no markdown):
    [
      {
        "datasetName": "Exact Dataset Name",
        "newsText": "Relevant news headline and details"
      }
    ]
    If none match, return: []
    `;

    try {
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim().replace(/```json/gi, "").replace(/```/g, "");
        const matches = JSON.parse(rawText);

        return matches.map(m => {
            const dataset = PAIRED_DATASETS.find(d => d.name === m.datasetName);
            return dataset ? { ...dataset, newsText: m.newsText } : null;
        }).filter(Boolean);
    } catch (error) {
        console.error("❌ Failed to batch-route datasets:", error.message);
        return [];
    }
}

/**
 * MAIN UPDATER: Executes updates only for verified dataset matches
 */
async function syncDynamicDatasets(articles) {
    console.log("🔍 Checking dynamic dataset triggers across all articles (Batch Router)...");
    const matchedUpdates = await identifyAllRelevantUpdates(articles);

    if (matchedUpdates.length === 0) {
        console.log("⏩ No dynamic dataset updates triggered today.");
        return;
    }

    console.log(`🎯 Triggered updates for ${matchedUpdates.length} dataset(s): ${matchedUpdates.map(m => m.name).join(", ")}`);

    for (const item of matchedUpdates) {
        console.log(`⏳ Cooling down 15s before updating ${item.name}...`);
        await sleep(15000);

        const enFile = await getFileFromGithub(item.enPath, CURRENT_AFFAIRS_REPO);
        const hiFile = await getFileFromGithub(item.hiPath, CURRENT_AFFAIRS_REPO);

        if (!enFile || !hiFile) {
            console.log(`⚠️ Skipping ${item.name} - File not found on GitHub.`);
            continue;
        }

        const today = new Date().toISOString().split("T")[0];


        const prompt = `
        You are an automated current affairs synchronization assistant.
        News Event: "${item.newsText}"
        
        Current English Dataset (${item.name}):
        ${JSON.stringify(enFile.json)}

        Current Hindi Dataset (${item.name}):
        ${JSON.stringify(hiFile.json)}

        CRITICAL INSTRUCTION FOR THIS DATASET:
        **${item.strategy}**

        Instructions:
        1. Apply the update to both English and Hindi JSON arrays according to the strategy above.
        2. Ensure accurate Hindi terminology for names, designations, and statuses.
        3. Set "last_updated": "${today}".
        4. If NO actual factual change applies, return ONLY the text "NO_CHANGE".

        Return format (strictly raw JSON, no markdown):
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
                    // 2. Commit updates to the current_affairs repo
                    await updateFileOnGithub(
                        item.enPath,
                        parsed.en,
                        enFile.sha,
                        `Auto-update (EN): ${item.name} - ${today}`,
                        CURRENT_AFFAIRS_REPO
                    );

                    await updateFileOnGithub(
                        item.hiPath,
                        parsed.hi,
                        hiFile.sha,
                        `Auto-update (HI): ${item.name} - ${today}`,
                        CURRENT_AFFAIRS_REPO
                    );

                    console.log(`✅ Successfully synced ${item.name} to GitHub.`);
                }
            } else {
                console.log(`[-] Verified no modification needed for: ${item.name}`);
            }
        } catch (error) {
            console.error(`❌ Error updating ${item.name}:`, error.message);
        }
    }
}

module.exports = { syncDynamicDatasets };