const { generateWithRetryAndFallback, updaterKey } = require("../config/ai");
const { getFileFromGithub, updateFileOnGithub, CURRENT_AFFAIRS_REPO } = require("./githubService");

const PAIRED_DATASETS = [
    { name: "Chief Ministers and Governors", enPath: "Dynamic_GK_Lists/English/Chief_Ministers_and_Governors.json", hiPath: "Dynamic_GK_Lists/Hindi/Chief_Ministers_and_Governors.json" },
    { name: "Global Indexes and Rankings", enPath: "Dynamic_GK_Lists/English/Global_Indexes_and_Rankings.json", hiPath: "Dynamic_GK_Lists/Hindi/Global_Indexes_and_Rankings.json" },
    { name: "Government Schemes", enPath: "Dynamic_GK_Lists/English/Government_Schemes.json", hiPath: "Dynamic_GK_Lists/Hindi/Government_Schemes.json" },
    { name: "Important Appointments 2026", enPath: "Dynamic_GK_Lists/English/Important_Appointments_2026.json", hiPath: "Dynamic_GK_Lists/Hindi/Important_Appointments_2026.json" },
    { name: "International Heads and Orgs", enPath: "Dynamic_GK_Lists/English/International_Heads_and_Orgs.json", hiPath: "Dynamic_GK_Lists/Hindi/International_Heads_and_Orgs.json" },
    { name: "Joint Military Exercises", enPath: "Dynamic_GK_Lists/English/Joint_Military_Exercises.json", hiPath: "Dynamic_GK_Lists/Hindi/Joint_Military_Exercises.json" },
    { name: "RBI Rates and Indexes", enPath: "Dynamic_GK_Lists/English/RBI_Rates_and_Indexes.json", hiPath: "Dynamic_GK_Lists/Hindi/RBI_Rates_and_Indexes.json" },
    { name: "Sports Champions and Venues", enPath: "Dynamic_GK_Lists/English/Sports_Champions_and_Venues.json", hiPath: "Dynamic_GK_Lists/Hindi/Sports_Champions_and_Venues.json" },
    { name: "Who's Who Cabinet Ministers", enPath: "Dynamic_GK_Lists/English/Whos_Who_Cabinet_Ministers.json", hiPath: "Dynamic_GK_Lists/Hindi/Whos_Who_Cabinet_Ministers.json" }
];

async function verifyAndUpdateSingleDataset(datasetIndex) {
    if (datasetIndex < 0 || datasetIndex >= PAIRED_DATASETS.length) {
        throw new Error(`Invalid dataset index: ${datasetIndex}`);
    }

    const item = PAIRED_DATASETS[datasetIndex];
    console.log(`🔍 [${item.name}] Checking English dataset for factual updates...`);

    const enFile = await getFileFromGithub(item.enPath, CURRENT_AFFAIRS_REPO);
    if (!enFile || !enFile.json) {
        throw new Error(`English file not found on GitHub: ${item.enPath}`);
    }

    const today = new Date().toISOString().split("T")[0];

    const prompt = `
You are an expert fact-checker and translator for Indian Competitive Exams datasets.

Target Dataset: "${item.name}"
Current English Dataset Content:
${JSON.stringify(enFile.json, null, 2)}

Task:
1. Check every record in this dataset against real-world current facts.
2. If there are NO factual updates needed, return strictly "NO_CHANGE".
3. If any entry has changed (new appointments, changed rates, winners, rankings):
   - Correct the English array.
   - Provide the exact parallel Hindi translation array (Devanagari script) with matching keys and structure.
   - Update or append "last_updated": "${today}".

Return Format (strictly raw JSON, no markdown blocks):
{
  "en": [ ...updated English array... ],
  "hi": [ ...corresponding translated Hindi array... ]
}
`;

    const result = await generateWithRetryAndFallback(prompt, updaterKey);
    let rawText = result.response.text().trim();

    if (rawText === "NO_CHANGE" || rawText.includes("NO_CHANGE")) {
        console.log(`✅ [${item.name}] English data is 100% up-to-date. Hindi check skipped.`);
        return { status: "Verified - No Changes" };
    }

    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : rawText;
    const parsed = JSON.parse(jsonStr);

    if (!parsed.en || !parsed.hi) {
        throw new Error(`Invalid response structure returned by AI for ${item.name}`);
    }

    const hiFile = await getFileFromGithub(item.hiPath, CURRENT_AFFAIRS_REPO);

    // Commit English update
    await updateFileOnGithub(
        item.enPath,
        parsed.en,
        enFile.sha,
        `Fact-Check Update (EN): ${item.name} - ${today}`,
        CURRENT_AFFAIRS_REPO
    );
    console.log(`🚀 Updated English: ${item.enPath}`);

    // Commit Hindi update
    await updateFileOnGithub(
        item.hiPath,
        parsed.hi,
        hiFile ? hiFile.sha : null,
        `Fact-Check Update (HI): ${item.name} - ${today}`,
        CURRENT_AFFAIRS_REPO
    );
    console.log(`🚀 Updated Hindi: ${item.hiPath}`);

    console.log(`🎉 [${item.name}] English & Hindi datasets synced successfully!`);
    return { status: "Updated Both Languages" };
}

module.exports = { verifyAndUpdateSingleDataset };