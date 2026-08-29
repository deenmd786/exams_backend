const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Fallback helper to prevent undefined key errors
const getKey = (specificKey) => specificKey || process.env.GEMINI_API_KEY;

// 1. Curation Client
const curationKey = getKey(process.env.GEMINI_CURATION_KEY);
const curationAI = new GoogleGenerativeAI(curationKey);
const curationModel = curationAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// 2. Primary / Quiz Client
const quizKey = getKey(process.env.GEMINI_QUIZ_KEY);
const primaryAI = new GoogleGenerativeAI(quizKey);
const primaryModel = primaryAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// 3. GitHub Updater Client
const updaterKey = getKey(process.env.GEMINI_UPDATER_KEY);
const updaterAI = new GoogleGenerativeAI(updaterKey);
const updaterModel = updaterAI.getGenerativeModel({ model: "gemini-3.6-flash" });

module.exports = {
    curationModel,
    primaryModel,
    updaterModel
};