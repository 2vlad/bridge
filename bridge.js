const path = require('path');
require('dotenv').config();
const puppeteer = require('puppeteer');
const { getClaudeResponse } = require('./claude-api');
const fs = require('fs');

const config = {
    lightPhoneUrl: 'https://dashboard.thelightphone.com/login', // Start at the login page
    lightPhoneEmail: process.env.LIGHT_PHONE_EMAIL,
    lightPhonePassword: process.env.LIGHT_PHONE_PASSWORD,
    claudeApiKey: process.env.CLAUDE_API_KEY,
    claudeModel: 'claude-3-sonnet-20240229', // Updated to a more common Sonnet model
    pollInterval: 60000, // Check every 60 seconds
    headless: true, // Railway: headless only
    triggerPrefixes: ['<', '>'], // Поддержка обоих знаков
    apiRateLimit: 60000, // 1 minute
    dryRun: false, // If true, don't edit notes, just log actions
};

// --- DOM SELECTORS ---
// IMPORTANT: These selectors have been updated based on the provided HTML.
// However, the editor selectors are still guesses and may need verification.
const SELECTORS = {
    // --- Login Page (Updated based on login page HTML) ---
    loginEmailInput: 'input[id$="_email"][type="text"]',
    loginPasswordInput: 'input[type="password"]',
    loginButton: 'label[for="login-submit"]',

    // --- Navigation (State-based, using XPath for robustness) ---
    // State 1: Main Menu -> click "Phone"
    mainMenuPhoneLinkXPath: "//a[contains(@class, 'MainMenu__link') and @href='/devices']",
    // State 2: Phone Selection -> click first phone item. It's an LI, not a link.
    phoneSelectionLinkXPath: "//body[//p[normalize-space(.)='Select a Phone']]//ul[contains(@class, 'MenuList')]//li[contains(@class, 'title')]",
    // State 3: Device Dashboard -> click "Toolbox"
    toolboxLinkXPath: "//ul[contains(@class, 'MenuList')]//li[normalize-space(.)='Toolbox']",
    // State 4: Device Tools -> click "Notes" - must match a link that ends *exactly* with /tools/notes
    notesToolLinkXPath: "//a[substring(@href, string-length(@href) - string-length('/tools/notes') + 1) = '/tools/notes']",
    // State 5: Intermediate Notes Page -> click "View Notes"
    viewNotesLinkXPath: "//a[./li[normalize-space(.)='View Notes']]",

    // --- Target State: Notes Page ---
    // The target is a page that contains at least one note item.
    // noteList: "ul:has(span.title)", // This was too ambiguous

    // --- Notes Page ---
    // A single note item in the list view
    noteItem: 'li.flex.flex-row',
    // The title span within a note item
    noteTitle: 'span.title',

    // Selector for the textarea when editing a note.
    // Updated based on the editor screenshot.
    noteEditorTextarea: 'textarea.ember-text-area',

    // Selector for the save button in the editor view.
    saveButton: 'button[type="submit"]',
};

let lastApiCallTimestamp = 0;
// This cache will now store the first 15 chars of the prompt to detect changes.
const noteCache = new Map();

async function main() {
    if (!config.claudeApiKey) {
        console.error('Error: CLAUDE_API_KEY is not set. Please create a .env file with your key.');
        process.exit(1);
    }

    const hasLoginCredentials = config.lightPhoneEmail && config.lightPhonePassword;
    if (!hasLoginCredentials) {
        console.log('INFO: LIGHT_PHONE_EMAIL or LIGHT_PHONE_PASSWORD not set in .env. Manual login will be required.');
    }

    console.log('--- Light Phone <-> Claude Bridge ---');
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userDataDir: './session',
    });
    const page = await browser.newPage();

    // If we are already logged in, the session will redirect us.
    // Start at the base dashboard URL.
    await page.goto('https://dashboard.thelightphone.com/', { waitUntil: 'networkidle2' });

    // Check if login is required
    if (page.url().includes('/login')) {
        const hasLoginCredentials = config.lightPhoneEmail && config.lightPhonePassword;
        if (hasLoginCredentials) {
            try {
                console.log('Login page detected. Attempting automatic login...');
                await page.waitForSelector(SELECTORS.loginEmailInput, { visible: true, timeout: 10000 });
                await page.type(SELECTORS.loginEmailInput, config.lightPhoneEmail, { delay: 50 });
                await page.type(SELECTORS.loginPasswordInput, config.lightPhonePassword, { delay: 50 });
                await page.click(SELECTORS.loginButton);
                console.log('Login form submitted.');
            } catch (e) {
                console.error('Automatic login failed. The selectors might be incorrect, or the page structure has changed.');
                console.log('Please log in manually.');
            }
        } else {
             console.log('\nPlease log in to your Light Phone account in the browser window.');
        }
        // Wait for login to complete by waiting for the URL to change
        await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 300000 });
    }
    
    console.log('Login successful! Starting navigation to Notes...');

    try {
        // Navigation is now a simple, linear sequence of clicks.
        // We assume the session is fresh or we start from the main menu.

        // Helper to find and click an element, waiting for it to appear.
        const findAndClick = async (xpath, description, waitTime = 2000) => {
            try {
                console.log(`Attempting to find and click: ${description}`);
                const element = await page.waitForSelector(`xpath/${xpath}`, { visible: true, timeout: 5000 });
                // We use a simple delay after click, as waitForNavigation is not reliable on this SPA.
                await element.click();
                console.log(`Clicked ${description}. Waiting ${waitTime}ms for UI to update.`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } catch (e) {
                console.log(`${description} not found or failed, assuming not applicable and continuing.`);
            }
        };
        
        // Step 1: Main Menu -> click "Phone" (if present)
        await findAndClick(SELECTORS.mainMenuPhoneLinkXPath, 'Main menu "Phone" link');
        
        // Step 2: Phone Selection -> click first phone (if present)
        await findAndClick(SELECTORS.phoneSelectionLinkXPath, 'Phone selection link');

        // Step 3: Device Dashboard -> click "Toolbox" (if present)
        await findAndClick(SELECTORS.toolboxLinkXPath, '"Toolbox" link');
        
        // Step 4: Tools Menu -> click "Notes" (if present)
        await findAndClick(SELECTORS.notesToolLinkXPath, '"Notes" tool link');
        
        // Step 5: Intermediate Notes Page -> click "View Notes" (if present)
        await findAndClick(SELECTORS.viewNotesLinkXPath, '"View Notes" button');
        
        const notesUrl = page.url(); // Get the final URL
        console.log(`Navigation complete. On page (${notesUrl}). Starting to monitor...`);
        
        const monitorInterval = setInterval(() => processNotes(page, notesUrl), config.pollInterval);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nGracefully shutting down...');
            clearInterval(monitorInterval);
            await browser.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('An unrecoverable error occurred during navigation.', error);
        await browser.close();
        process.exit(1);
    }
}

async function processNotes(page, notesUrl) {
    console.log(`\n[${new Date().toISOString()}] Scanning for notes with trigger "${config.triggerPrefixes.join(', ')}"...`);
    // Всегда начинаем с главной страницы
    await page.goto('https://dashboard.thelightphone.com/', { waitUntil: 'networkidle2' });
    // Повторяем путь до заметок через findAndClick
    const findAndClick = async (xpath, description, waitTime = 2000) => {
        try {
            console.log(`Attempting to find and click: ${description}`);
            const element = await page.waitForSelector(`xpath/${xpath}`, { visible: true, timeout: 5000 });
            await element.click();
            console.log(`Clicked ${description}. Waiting ${waitTime}ms for UI to update.`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        } catch (e) {
            console.log(`${description} not found or failed, assuming not applicable and continuing.`);
        }
    };
    await findAndClick(SELECTORS.mainMenuPhoneLinkXPath, 'Main menu "Phone" link');
    await findAndClick(SELECTORS.phoneSelectionLinkXPath, 'Phone selection link');
    await findAndClick(SELECTORS.toolboxLinkXPath, '"Toolbox" link');
    await findAndClick(SELECTORS.notesToolLinkXPath, '"Notes" tool link');
    await findAndClick(SELECTORS.viewNotesLinkXPath, '"View Notes" button');
    // После навигации проверяем
    if (!page.url().endsWith('/tools/notes/view')) {
        console.log('Navigation to notes page failed. Skipping this cycle.');
        return;
    }
    // Дальше — как раньше
    try {
        console.log('Waiting for note items to render...');
        await page.waitForSelector(SELECTORS.noteItem, { timeout: 10000 });
        console.log('Note items found. Proceeding with scan.');
        const notes = await page.$$(SELECTORS.noteItem);
        console.log(`Found ${notes.length} notes.`);

        for (const noteHandle of notes) {
            const titleEl = await noteHandle.$(SELECTORS.noteTitle);
            if (!titleEl) continue;

            const title = await page.evaluate(el => el.textContent.trim(), titleEl);
            
            const noteLink = await noteHandle.$('a');
            const noteId = noteLink ? await page.evaluate(el => el.getAttribute('href'), noteLink) : null;
            
            // Проверяем на любой из префиксов
            const matchedPrefix = config.triggerPrefixes.find(prefix => title.startsWith(prefix));
            if (matchedPrefix) {
                // Get the first 15 characters of the prompt for comparison (после префикса)
                const promptSnippet = title.substring(matchedPrefix.length).trim().slice(0, 15);
                
                if (noteCache.has(noteId) && noteCache.get(noteId) === promptSnippet) {
                    continue; 
                }
                
                console.log(`Found new/changed prompt for ID ${noteId}: "${promptSnippet}..."`);
                await handleSingleNote(page, noteHandle, noteId, promptSnippet);

                // After handling one note, we break the loop and wait for the next full scan.
                console.log('Breaking loop after processing one note.');
                break; 
            }
        }
    } catch (error) {
        console.error('Error during note processing loop:', error);
        // If an error occurs while inside a note, navigate back to the list
        if (page.url().includes('/view/')) {
            console.log('An error occurred within a note view. Returning to main list...');
            await page.goto(notesUrl, { waitUntil: 'networkidle2' });
        }
    }
}

async function handleSingleNote(page, noteHandle, noteId, promptSnippet) {
    console.log(`Processing note ID: ${noteId}`);

    if (config.dryRun) {
        console.log(`[DRY RUN] Would process note: "${await page.evaluate(h => h.textContent, noteHandle)}".`);
        noteCache.set(noteId, promptSnippet); // Update cache even in dry run
        return;
    }

    // 1. Click to enter editor
    await noteHandle.click();
    await page.waitForSelector(SELECTORS.noteEditorTextarea, { visible: true, timeout: 10000 });
    console.log('Note editor opened.');

    // 2. Get full text and check for existing response
    const editorHandle = await page.$(SELECTORS.noteEditorTextarea);
    const fullText = await page.evaluate(el => el.value, editorHandle);

    if (fullText.includes('---')) {
        console.log('Note already contains a response ("---"). Skipping and caching.');
        noteCache.set(noteId, promptSnippet); // Cache it so we don't re-process
        return;
    }

    // 3. Rate limit API calls
    const now = Date.now();
    if (now - lastApiCallTimestamp < config.apiRateLimit) {
        console.log(`Rate limit active. Waiting for ${((config.apiRateLimit - (now - lastApiCallTimestamp)) / 1000).toFixed(1)}s.`);
        return;
    }

    // 4. Send to Claude API
    const prompt = fullText.substring(config.triggerPrefixes[0].length).trim();
    console.log(`Sending to Claude: "${prompt}"`);
    let claudeResponse;
    try {
        lastApiCallTimestamp = Date.now();
        claudeResponse = await getClaudeResponse(prompt, config.claudeApiKey, config.claudeModel);
        console.log('Received response from Claude.');
    } catch (error) {
        console.error('Error from Claude API:', error.message);
        claudeResponse = `❌ Ошибка: ${error.message}`;
    }

    // 5. Add response to note
    const newText = `${fullText}\n\n---\n\n${claudeResponse}`;
    await page.evaluate((el, text) => {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, editorHandle, newText);

    console.log('Note content updated in browser. Saving...');

    // 6. Click the save button
    await page.click(SELECTORS.saveButton);

    // 7. Wait for the page to navigate back to the notes list
    console.log('Waiting for navigation back to the notes list...');
    try {
        await page.waitForSelector(SELECTORS.noteItem, { visible: true, timeout: 15000 });
    } catch (e) {
        console.log('Note list not found after save, trying to go back manually...');
        try {
            await page.goBack({ waitUntil: 'networkidle2' });
            await page.waitForSelector(SELECTORS.noteItem, { visible: true, timeout: 15000 });
        } catch (e2) {
            console.log('Still could not find note list after manual goBack.');
        }
    }

    console.log('Note saved successfully.');
    noteCache.set(noteId, promptSnippet); // Cache the processed prompt snippet
    console.log(`Note ID ${noteId} marked as processed with snippet: "${promptSnippet}"`);
}


main().catch(console.error); 