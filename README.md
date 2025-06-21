# Light Phone <-> Claude Bridge

This Node.js application automates your Light Phone notes by connecting them to the Anthropic Claude API. It monitors your notes, finds ones that start with a specific trigger (e.g., `<`), sends the content to Claude, and appends the AI's response directly into the note.

## Features

- **Automatic Note Processing**: Runs in the background and periodically checks for new notes to process.
- **Claude API Integration**: Seamlessly gets intelligent responses from Anthropic's Claude model.
- **Configurable**: Easily change the trigger prefix, polling interval, and other settings.
- **Rate Limiting**: Prevents spamming the Claude API by ensuring a minimum time between requests.
- **Error Handling**: Gracefully handles API errors and logs them into the note.
- **Debugging Tools**: Includes a "dry run" mode and the option to run the browser in non-headless mode to see what's happening.
- **Session Cache**: Remembers which notes have been processed to avoid duplicate API calls.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- A Light Phone account
- A Claude (Anthropic) API key

## Setup and Installation

1.  **Clone or Download the Project**:
    Get the project files onto your local machine.

2.  **Navigate to Project Directory**:
    Open your terminal and `cd` into the project folder.
    ```bash
    cd lightphone-claude-bridge
    ```

3.  **Create `.env` File**:
    This file stores your secret API key. Create a new file named `.env` in the root of the project and add your Claude API key like this:
    ```
    CLAUDE_API_KEY="sk-..."
    ```
    **Important**: Do not share this file or commit it to version control. The `.gitignore` file is already configured to ignore it.

4.  **Install Dependencies**:
    Run `npm install` to download the required packages (`puppeteer`, `axios`, `dotenv`).
    ```bash
    npm install
    ```
    *If you encounter a `EJSONPARSE` error, please ensure `package.json` is not empty and is valid JSON. If the problem persists, try running `npm cache clean --force`.*

## How to Run

1.  **Start the application**:
    ```bash
    npm start
    ```
2.  **Log In**:
    A Chromium browser window will open. You must **manually log in** to your Light Phone dashboard. The script will wait for you to log in before it starts monitoring your notes.

3.  **Let it Run**:
    Once you're logged in, the script will navigate to the notes page and begin its monitoring cycle. You can minimize the browser window and leave the script running in your terminal.

## How to Use

1.  Open the Notes tool on your Light Phone or in the dashboard.
2.  Create a new note or edit an existing one.
3.  Start the note content with the trigger prefix (default is `<`). For example:
    `<What is the distance between the Earth and the Moon?`
4.  Within the configured polling interval (default is 15 seconds), the script will detect the note.
5.  It will send the query to Claude and update the note with the answer, separated by `---`.

    **Example Result**:
    ```
    <What is the distance between the Earth and the Moon?

    ---

    The average distance between the Earth and the Moon is about 384,400 kilometers (about 238,855 miles). This distance can vary because the Moon's orbit is elliptical.
    ```

## Configuration

You can customize the script's behavior by editing the `config` and `SELECTORS` objects at the top of `bridge.js`.

### Key Configuration Options (`config`)

- `headless`: Set to `true` to run the browser in the background without a visible UI. Set to `false` for debugging.
- `pollInterval`: Time in milliseconds between each check for new notes.
- `triggerPrefix`: The character(s) the script looks for at the beginning of a note to trigger processing.
- `dryRun`: Set to `true` to test the script. It will log the actions it *would* take without actually calling the API or modifying your notes.

### DOM Selectors (`SELECTORS`)

**This is the most important part to check if the script is not working.** Website structures change. If the script fails to find your notes, you'll need to update these CSS selectors.

To find the correct selectors:
1.  Open your Light Phone dashboard notes page in Chrome/Firefox.
2.  Right-click on an element you want the script to interact with (e.g., the list of notes, a note's title, the text editor).
3.  Select "Inspect".
4.  In the developer tools, find a stable selector (e.g., a class like `.NotesList` or an ID like `#note-editor`).
5.  Update the corresponding value in the `SELECTORS` object in `bridge.js`. 