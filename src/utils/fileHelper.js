const fs = require('fs').promises;
const path = require('path');

// This always targets the 'data' folder at the root of your project
const DATA_DIR = path.join(process.cwd(), 'data');

async function readData(fileName) {
    const filePath = path.join(DATA_DIR, fileName);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist yet, return an empty array
        return [];
    }
}

async function writeData(fileName, data) {
    const filePath = path.join(DATA_DIR, fileName);

    // Create sub-folders (like 'news') automatically if they don't exist
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Save the file with beautiful 4-space formatting
    await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf-8');
}

module.exports = { readData, writeData };