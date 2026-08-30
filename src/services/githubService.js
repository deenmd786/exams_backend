const axios = require('axios');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DEFAULT_REPO = process.env.GITHUB_REPO || "deenmd786/All_Exams_Data_Set";
const CURRENT_AFFAIRS_REPO = process.env.GITHUB_CURRENT_AFFAIRS_REPO || "deenmd786/current_affairs";

const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Exam-Backend-Sync'
    }
});

/**
 * Fetches file content and SHA from GitHub (returns null if file does not exist yet)
 */
async function getFileFromGithub(filePath, repo = DEFAULT_REPO) {
    try {
        const response = await githubApi.get(`/repos/${repo}/contents/${filePath}`);
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return {
            sha: response.data.sha,
            json: JSON.parse(content)
        };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // File does not exist yet (e.g. start of a new month)
        }
        console.error(`❌ Error reading ${filePath} from ${repo}:`, error.message);
        throw error;
    }
}

/**
 * Creates or updates a JSON file on GitHub
 */
async function updateFileOnGithub(filePath, jsonData, sha = null, commitMessage = "Auto update dataset", repo = DEFAULT_REPO) {
    const formattedContent = Buffer.from(JSON.stringify(jsonData, null, 4), 'utf-8').toString('base64');

    const payload = {
        message: commitMessage,
        content: formattedContent
    };

    if (sha) {
        payload.sha = sha; // Required when updating an existing file
    }

    try {
        await githubApi.put(`/repos/${repo}/contents/${filePath}`, payload);
        console.log(`🚀 Successfully uploaded: ${filePath} to ${repo}`);
    } catch (error) {
        console.error(`❌ Failed to commit ${filePath} on ${repo}:`, error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    getFileFromGithub,
    updateFileOnGithub,
    CURRENT_AFFAIRS_REPO,
    DEFAULT_REPO
};