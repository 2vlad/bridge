# Light Phone + Claude SaaS MVP

This is a minimal, fully functional SaaS application that integrates Light Phone notes with the Anthropic Claude API. It provides a simple web interface for users to manage their integration settings and view processing logs.

## Features

- **User Authentication**: Simple email/password registration and login with JWT sessions.
- **User Settings**: Manage Light Phone credentials, device URL, and Claude API key.
- **Automated Note Processing**: A background worker periodically scans user notes for a trigger symbol, sends the content to Claude, and appends the AI's response.
- **Simple Frontend**: A clean, responsive, dark-themed dashboard built with Next.js and shadcn/ui.
- **API and Logging**: A simple Express API and logging to JSON files.
- **Ready for Deployment**: Configured for easy deployment on platforms like Railway.

## Quick Start

### 1. Installation

First, install dependencies for both the backend server and the frontend application.

```bash
npm run install:all
```

### 2. Environment Variables

Copy the example environment file and fill in your details.

```bash
cp .env.example .env
```

You'll need to set `JWT_SECRET` to a long, random string.

### 3. Running Locally

You need to run the backend server and the frontend development server in two separate terminals.

**Terminal 1: Start the Backend Server**
```bash
npm start
```
The server will start on `http://localhost:3000` (or the port you specified in `.env`).

**Terminal 2: Start the Frontend Dev Server**
```bash
npm run dev:frontend
```
The frontend will be available at a different port, usually `http://localhost:3001`.

Now, open `http://localhost:3001` in your browser.

## How to Use

1.  **Register**: Create a new account using your email and a password.
2.  **Log In**: Sign in to your account.
3.  **Configure Settings**: Navigate to the settings page and enter:
    - Your Light Phone email and password.
    - Your Light Phone device URL.
    - Your Claude API key.
4.  **Create a Note**: On your Light Phone or in the dashboard, create a note that starts with a trigger symbol (e.g., `<`).
5.  **Wait**: The background worker runs every 2 minutes. It will find your note, process it with Claude, and append the response.

## Deployment on Railway

This project is ready for deployment on Railway.

1.  **Push to GitHub**: Make sure your project is a GitHub repository.
2.  **Create a New Project**: On Railway, select "Deploy from GitHub repo" and choose your repository.
3.  **Configure Environment Variables**: In the Railway project settings, go to the "Variables" tab and add your secrets (`JWT_SECRET`, etc.).
4.  **Set Start Command**:
    - For the backend, the start command will likely be `npm start`.
    - For the frontend (if deployed separately), you'll need to configure it to run `npm run build` and then `npm start`. Railway's Nixpacks will often handle this automatically for Next.js apps.
5.  **Deploy**: Railway will build and deploy your application.

## Project Structure

- `server.js`: The main Express.js backend server.
- `worker.js`: The background worker that processes notes.
- `config.js`: Application configuration, loaded from `.env`.
- `services/`: Contains business logic for users, Claude, and Light Phone.
- `middlewares/`: Custom Express middleware (e.g., `auth.js`).
- `data/`: Stores JSON files for users and logs (ignored by Git).
- `front/`: The Next.js frontend application.
- `.env.example`: An example environment file.
- `README.md`: This file. 