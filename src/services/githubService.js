const { Octokit } = require("@octokit/rest");
require("dotenv").config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_OWNER || "deenmd786";
const REPO = process.env.GITHUB_REPO || "current_affairs";
const BRANCH = process.env.GITHUB_BRANCH || "main";

/**
 * Fetch file content and its SHA from GitHub safely
 */
async function getFileFromGithub(path) {
    try {
        const { data } = await octokit.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: path,
            ref: BRANCH,
        });

        // Decode Base64 content
        let content = Buffer.from(data.content, "base64").toString("utf-8");

        // Remove BOM (\uFEFF) and zero-width spaces that cause JSON.parse crashes
        content = content.replace(/^[\uFEFF\xA0]+/, "").trim();

        return {
            sha: data.sha,
            json: JSON.parse(content),
        };
    } catch (error) {
        console.error(`Error fetching ${path} from GitHub:`, error.message);
        return null;
    }
}

/**
 * Update and commit a file directly on GitHub
 */
async function updateFileOnGithub(path, jsonContent, sha, commitMessage) {
    try {
        const updatedContentBase64 = Buffer.from(
            JSON.stringify(jsonContent, null, 4)
        ).toString("base64");

        await octokit.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: path,
            message: commitMessage,
            content: updatedContentBase64,
            sha: sha,
            branch: BRANCH,
        });

        console.log(`[GITHUB COMMITTED] Successfully updated: ${path}`);
        return true;
    } catch (error) {
        console.error(`Failed to commit update for ${path}:`, error.message);
        return false;
    }
}

module.exports = { getFileFromGithub, updateFileOnGithub };