const { generateWithRetryAndFallback, curationKey } = require("../config/ai");

/**
 * Curates the top exam-worthy articles from raw feed items
 */
async function getExamWorthyArticles(articles, requiredCount = 5) {
    if (!articles || articles.length === 0) return [];
    if (articles.length <= requiredCount) return articles;

    const payload = articles.map((a, i) => ({
        index: i,
        title: a.title,
        context: a.description ? a.description.substring(0, 180) : ""
    }));

    const prompt = `
You are an expert Current Affairs curator for Indian competitive exams (UPSC, SSC, Banking, State PSCs).
Below is a list of raw news headlines and context snippets:

${JSON.stringify(payload, null, 2)}

TASK:
Select exactly ${requiredCount} MOST CRITICAL news items with the highest probability of appearing in exams.

PRIORITIZE:
- Government schemes, national portals, and major policy rollouts
- Key constitutional appointments, judicial elevations, and resignations
- Defence (DRDO/ISRO tests, bilateral military exercises, defense deals)
- Economy (RBI/SEBI policies, GDP figures, inflation indices)
- International summits (G20, SCO, BRICS, UN, ASEAN)
- Major sports champions and tournaments

EXCLUDE:
- Local crime, political rallies, festival greetings, and mundane administrative updates.
- Non-English headlines.

Return ONLY a raw JSON array of numbers representing the chosen indexes, e.g., [0, 3, 7, 12, 18].
No markdown, no backticks, no explanations.
`;

    try {
        const result = await generateWithRetryAndFallback(prompt, curationKey);
        let rawText = result.response.text().trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const match = rawText.match(/\[[\s\S]*\]/);
        const jsonStr = match ? match[0] : rawText;
        const selectedIndexes = JSON.parse(jsonStr);

        if (!Array.isArray(selectedIndexes)) {
            throw new Error("AI did not return a valid index array");
        }

        const curated = selectedIndexes
            .map((i) => articles[Number(i)])
            .filter((a) => a !== undefined);

        if (curated.length >= requiredCount) {
            return curated.slice(0, requiredCount);
        }

        // Fill shortfall from raw articles if index matching had missing items
        const remaining = articles.filter(a => !curated.includes(a));
        return [...curated, ...remaining].slice(0, requiredCount);

    } catch (error) {
        console.error("⚠️ Curation fallback triggered:", error.message);
        return articles.slice(0, requiredCount);
    }
}

module.exports = { getExamWorthyArticles };