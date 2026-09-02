const { getFileFromGithub, updateFileOnGithub, CURRENT_AFFAIRS_REPO } = require('./githubService');

/**
 * Returns YYYY-MM-DD strictly in Indian Standard Time (IST)
 */
function getISTDateString(dateObj = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dateObj);
}

/**
 * Generates dynamic folder paths for English and Hindi:
 * e.g., 2026/Article/English/09_September_2026.json
 */
function getMonthlyPaths(lang = 'English', dateObj = new Date()) {
    const istDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const year = istDate.getFullYear();
    const monthNumber = String(istDate.getMonth() + 1).padStart(2, '0');
    const monthName = istDate.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });

    const fileName = `${monthNumber}_${monthName}_${year}.json`;

    return {
        year,
        monthName,
        todayStr: getISTDateString(dateObj),
        articlePath: `${year}/Article/${lang}/${fileName}`,
        quizPath: `${year}/Quiz/${lang}/${fileName}`
    };
}

async function syncArticlesToGithub(articles, lang = 'English') {
    const { articlePath, todayStr, monthName, year } = getMonthlyPaths(lang);
    console.log(`📤 Syncing ${lang} articles to GitHub: ${articlePath}`);

    const existingFile = await getFileFromGithub(articlePath, CURRENT_AFFAIRS_REPO);
    let monthlyArticles = existingFile && Array.isArray(existingFile.json) ? existingFile.json : [];

    const todayEntry = {
        date: todayStr,
        total_articles: articles.length,
        articles: articles
    };

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

async function syncQuizzesToGithub(quizzes, lang = 'English') {
    const { quizPath, todayStr, monthName, year } = getMonthlyPaths(lang);
    console.log(`📤 Syncing ${lang} quizzes to GitHub: ${quizPath}`);

    const existingFile = await getFileFromGithub(quizPath, CURRENT_AFFAIRS_REPO);
    let monthlyQuizzes = existingFile && Array.isArray(existingFile.json) ? existingFile.json : [];

    const newQuizIds = new Set(quizzes.map(q => q.id));
    monthlyQuizzes = monthlyQuizzes.filter(q => !newQuizIds.has(q.id));
    monthlyQuizzes.push(...quizzes);

    const sha = existingFile ? existingFile.sha : null;
    const commitMsg = `Update Daily Quizzes (${lang}): ${todayStr} (${monthName} ${year})`;

    await updateFileOnGithub(quizPath, monthlyQuizzes, sha, commitMsg, CURRENT_AFFAIRS_REPO);
}

module.exports = {
    syncArticlesToGithub,
    syncQuizzesToGithub,
    getISTDateString
};