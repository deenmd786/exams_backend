const { curationModel } = require("../config/ai");

async function getExamWorthyArticles(articles, requiredCount = 5) {
    if (!articles || articles.length <= requiredCount) return articles || [];

    // Send indexes and titles to keep tokens ultra-low
    const payload = articles.map((a, i) => ({ index: i, title: a.title }));

    const prompt = `
You are an expert Current Affairs curator for Indian competitive exams (UPSC, SSC, Banking, State PSCs).
Below is a list of raw news headlines fetched today:

${JSON.stringify(payload, null, 2)}

TASK:
Select exactly ${requiredCount} MOST CRITICAL and HIGH-YIELD news items that have the highest probability of appearing in Indian competitive exams.

PRIORITIZE:
- High-level government schemes, policy rollouts, portals, and subsidies
- Key constitutional appointments, judicial elevations, and national resignations
- Defence updates (DRDO/ISRO tests, bilateral military exercises, defense acquisitions)
- Economy, RBI/SEBI policy updates, GDP projections, and major indices
- Bilateral/multilateral summits (G20, SCO, BRICS, UN)
- Major sports champions and tournaments

EXCLUDE:
- Routine festival greetings, condolences, local political rallies, crime reports, or mundane administrative announcements.
- Any non-English headlines.

Output format (strictly raw JSON array of 5 indices):
[2, 14, 28, 45, 62]
`;

    try {
        const result = await curationModel.generateContent(prompt);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const selectedIndexes = JSON.parse(rawText);

        const curated = selectedIndexes
            .map((i) => articles[i])
            .filter((a) => a !== undefined);

        return curated.slice(0, requiredCount);
    } catch (error) {
        console.error("⚠️ Curation fallback triggered:", error.message);
        return articles.slice(0, requiredCount);
    }
}

module.exports = { getExamWorthyArticles };