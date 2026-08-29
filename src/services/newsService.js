const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000 // 10s timeout per feed to prevent hanging
});

// ✅ Targeted RSS feeds for Indian Competitive Exams (UPSC, SSC, Banking, State PSCs)
const EXAM_NEWS_FEEDS = [
    // PIB (Press Information Bureau)
    { name: "PIB India (Cabinet/National)", url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3" },

    // The Hindu Feeds
    { name: "The Hindu (National)", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
    { name: "The Hindu (Economy & Business)", url: "https://www.thehindu.com/business/Economy/feeder/default.rss" },

    // Google News - Strictly Geo-targeted to India (en-IN)
    { name: "Google News (India National)", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en" },
    { name: "Google News (India Economy & Markets)", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en" },
    { name: "Google News (Science & Tech)", url: "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-IN&gl=IN&ceid=IN:en" }
];

// Helper function to detect and filter out Hindi script
function containsHindi(text) {
    const hindiRegex = /[\u0900-\u097F]/;
    return hindiRegex.test(text);
}

// Strip HTML tags and entities from descriptions
function cleanSnippet(rawText) {
    if (!rawText) return "";
    return rawText
        .replace(/<[^>]*>?/gm, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchFromLocalMock() {
    try {
        const filePath = path.join(__dirname, '../../data/sample_headlines.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data.replace(/^[\uFEFF\xA0]+/, '').trim());
        return parsed.articles || [];
    } catch (error) {
        console.warn("⚠️ No local sample_headlines.json found:", error.message);
        return [];
    }
}

async function fetchAllFeeds() {
    const rawArticles = [];

    // Fetch all feeds in parallel
    const feedPromises = EXAM_NEWS_FEEDS.map(async (feedSource) => {
        try {
            const feed = await parser.parseURL(feedSource.url);

            // Take up to 20 fresh items per feed
            feed.items.slice(0, 20).forEach(item => {
                if (item.title && !containsHindi(item.title)) {
                    const snippet = cleanSnippet(item.contentSnippet || item.content || item.summary || item.title);

                    rawArticles.push({
                        title: item.title.trim(),
                        description: snippet.slice(0, 300), // Concise context for Gemini
                        source: feedSource.name,
                        link: item.link || ""
                    });
                }
            });
        } catch (error) {
            console.error(`❌ Failed to fetch [${feedSource.name}]:`, error.message);
        }
    });

    await Promise.all(feedPromises);
    return rawArticles;
}

/**
 * Main function to fetch, sanitize, and deduplicate 80-100 raw articles
 */
async function fetchDailyArticles(targetLimit = 100) {
    if (process.env.USE_LOCAL_MOCK === 'true') {
        console.log("🛠️ Reading articles from data/sample_headlines.json");
        return await fetchFromLocalMock();
    }

    console.log("📡 Fetching raw current affairs from Indian RSS feeds...");
    const combined = await fetchAllFeeds();

    // Deduplicate by lowercase headline
    const seenTitles = new Set();
    const uniqueArticles = [];

    for (const item of combined) {
        const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(normalizedTitle) && normalizedTitle.length > 10) {
            seenTitles.add(normalizedTitle);
            uniqueArticles.push(item);
        }
    }

    console.log(`✅ Collected ${uniqueArticles.length} unique raw articles from all sources.`);

    // Return up to targetLimit (e.g. 80-100) for Gemini curation
    return uniqueArticles.slice(0, targetLimit);
}

module.exports = { fetchDailyArticles };