const { getFileFromGithub, updateFileOnGithub, CURRENT_AFFAIRS_REPO } = require('./githubService');

/**
 * Generates folder paths dynamically for English and Hindi:
 * e.g., 2026/Article/English/09_September_2026.json
 *       2026/Article/Hindi/09_September_2026.json
 */
function getMonthlyPaths(lang = 'English', dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const monthNumber = String(dateObj.getMonth() + 1).padStart(2, '0');
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });

    const fileName = `${monthNumber}_${monthName}_${year}.json`;

    return {
        year,
        monthName,
        todayStr: dateObj.toISOString().split('T')[0],
        articlePath: `${year}/Article/${lang}/${fileName}`,
        quizPath: `${year}/Quiz/${lang}/${fileName}`
    };
}

/**
 * Syncs today's curated articles to the monthly article file on GitHub
 */
async function syncArticlesToGithub(articles, lang = 'English') {
    const { articlePath, todayStr, monthName, year } = getMonthlyPaths(lang);
    console.log(`📤 Syncing ${lang} articles to GitHub: ${articlePath}`);

    const existingFile = await getFileFromGithub(articlePath, CURRENT_AFFAIRS_REPO);
    let monthlyArticles = existingFile ? existingFile.json : [];

    if (!Array.isArray(monthlyArticles)) {
        monthlyArticles = [];
    }

    const todayEntry = {
        date: todayStr,
        total_articles: articles.length,
        articles: articles
    };

    // Replace if today already exists, or append if new day
    const dayIndex = monthlyArticles.findIndex(item => item.date === todayStr);
    if (dayIndex >= 0) {
        monthlyArticles[dayIndex] = todayEntry;
    } else {
        monthlyArticles.push(todayEntry);
    }

    const sha = existingFile ? existingFile.sha : null;
    const commitMsg = `Update Daily Articles (${lang}): ${todayStr} (${monthName} ${year})`;

    await updateFileOnGithub(articlePath, monthlyArticles, sha, commitMsg, CURRENT_AFFAIRS_REPO);
}

/**
 * Syncs today's generated quizzes to the monthly quiz file on GitHub
 */
async function syncQuizzesToGithub(quizzes, lang = 'English') {
    const { quizPath, todayStr, monthName, year } = getMonthlyPaths(lang);
    console.log(`📤 Syncing ${lang} quizzes to GitHub: ${quizPath}`);

    const existingFile = await getFileFromGithub(quizPath, CURRENT_AFFAIRS_REPO);
    let monthlyQuizzes = existingFile ? existingFile.json : [];

    if (!Array.isArray(monthlyQuizzes)) {
        monthlyQuizzes = [];
    }

    // Filter out duplicate IDs/questions if re-run on the same day
    const newQuizIds = new Set(quizzes.map(q => q.id));
    monthlyQuizzes = monthlyQuizzes.filter(q => !newQuizIds.has(q.id));

    // Append new quizzes
    monthlyQuizzes.push(...quizzes);

    const sha = existingFile ? existingFile.sha : null;
    const commitMsg = `Update Daily Quizzes (${lang}): ${todayStr} (${monthName} ${year})`;

    await updateFileOnGithub(quizPath, monthlyQuizzes, sha, commitMsg, CURRENT_AFFAIRS_REPO);
}

module.exports = {
    syncArticlesToGithub,
    syncQuizzesToGithub
};