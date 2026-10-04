# Aarav - ITI Admission Voice & Text Assistant

Aarav is a modern voice and text-based AI assistant for ITI admissions counseling. It combines a React frontend with an Express server and Google Gemini APIs to provide:

- Speech-to-speech voice conversations
- Text-to-text AI chat
- Text-to-speech audio generation
- Live voice session handling
- Admission guidance for trades, eligibility, documents, and fees
- Debugging, health checks, and activity history

This project is designed to help prospective students, parents, and counselors interact with an admission guidance assistant in a simple, conversational way.

## Features

- Multi-mode assistant experience:
  - Speech-to-speech
  - Text-to-text
  - Text-to-speech
  - History and debugging
- ITI-focused knowledge base for:
  - Eligibility rules
  - Trade selection guidance
  - Admission process flow
  - Documents and fee guidance
  - Helpdesk escalation handling
- Real-time Gemini integration using the Google GenAI SDK
- WebSocket communication for live voice experiences
- Local browser storage for chat and TTS history
- Built-in system health endpoint and logs viewer

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Real-time communication: WebSockets (`ws`)
- AI provider: Google Gemini (`@google/genai`)
- Styling: Tailwind CSS
- Runtime tooling: Node.js + tsx

## Prerequisites

Before running the project, make sure you have the following installed:

- Node.js 18+ or newer
- npm 9+ or Bun 1.x (the project includes a `bun.lock` file, but npm is the primary supported path)
- A valid Google Gemini API key
- Microphone access for browser-based voice features

## Installation

1. Clone the repository

   ```bash
   git clone https://github.com/MihirLakhamje/ai-voice.git
   cd ai-voice
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Configure environment variables

   Copy the sample environment file and update it with your keys:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set:

   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   APP_URL="http://localhost:3000"
   ```

   Note: In AI Studio or deployment environments, credentials may be injected automatically from secrets instead of a local `.env` file.

## Running the App

Start the development server:

```bash
npm run dev
```

This runs the Express server and serves the app. By default the app is available at:

```text
http://localhost:3000
```

## Production Build

To create a production build:

```bash
npm run build
```

To run the built app in production-like mode:

```bash
npm start
```

## Available Scripts

```bash
npm run dev      # start local development server
npm run build    # build the frontend bundle
npm run start    # start the server
npm run preview  # preview production build locally
npm run lint     # TypeScript type checking
npm run clean    # remove build artifacts
```

## Project Structure

```text
ai-voice/
├── src/                     # React frontend source
│   ├── components/          # UI panels and interaction components
│   ├── utils/              # Shared utility logic and logging
│   ├── App.tsx             # Main app layout
│   ├── main.tsx            # App entry point
│   └── types.ts            # Shared TypeScript types
├── server.ts                # Express server, Gemini integration, and WebSocket logic
├── .env.example             # Sample environment variables
├── .env                     # Local environment configuration
├── index.html               # Root HTML entry
├── package.json             # Scripts and dependencies
├── tsconfig.json            # TypeScript compiler settings
├── vite.config.ts           # Vite configuration
├── dist/                    # Production build output
├── node_modules/            # Installed dependencies
└── README.md                # Project documentation
```

## Environment Variables

### GEMINI_API_KEY
Required for interacting with Google's Gemini models for chat, TTS, and live session requests.

- Must be valid and active
- If missing or set to placeholder values, the server returns a user-friendly configuration error
- Never commit real API keys to version control

### APP_URL
Used for app self-reference in certain hosted deployments or OAuth-related setup flows. In local development, `http://localhost:3000` is typically sufficient.

## Important Notes

### 1. Voice and microphone permissions
Browser-based voice features require microphone access. Users must allow microphone permission in the browser when prompted.

### 2. API key validation
The server checks whether the Gemini API key is configured before creating a client. If no valid key is found, the assistant will not make AI calls and will report the configuration issue clearly.

### 3. Local storage usage
Chat history and TTS records are saved in the browser using localStorage. This is designed for convenience and debugging, but it is not a secure persistence layer for production-sensitive data.

### 4. WebSocket and live sessions
The backend uses WebSockets to support live speech workflows. If the server is not running or the socket connection fails, the voice assistant may not work correctly.

### 5. Security and secrets
- Keep `.env` local and out of source control
- Do not expose production keys in public repos
- Prefer secret-management solutions in production deployments

### 6. Health and logs
The project includes `/api/health` and log viewers to help diagnose server/client issues, which is helpful during development and testing.

### 7. AI assistant behavior
The assistant is intentionally configured for ITI admissions counseling and is tuned to answer questions around:
- trade selection
- eligibility
- application process
- documents
- common concerns
- escalation to a helpdesk when appropriate

## Troubleshooting

### Server fails to start
Check that:
- Node.js is installed
- dependencies were installed with `npm install`
- environment variables are present in `.env`

### Gemini API errors
Verify:
- `GEMINI_API_KEY` is valid
- billing/quota is available for your Google Cloud project
- the runtime has network access to the Gemini API

### Microphone not working
Confirm:
- the page has browser permission to access the microphone
- desktop/mobile browser is not blocking device access
- the page is served over `localhost` or a trusted domain

### Build problems
Run:

```bash
npm run lint
```

If type errors appear, resolve the TypeScript issues before building.

## Deployment Considerations

This app is suitable for deployment as a Node.js service in a cloud environment such as:

- Google Cloud Run
- Vercel
- Render
- Railway
- Docker-based hosting

When deploying:
- set environment variables in the hosting provider
- configure the app URL correctly
- ensure both HTTP and WebSocket traffic are allowed if using live voice features

## License

This project does not currently declare an explicit license file. Please check the repository policy before redistributing or reusing the code in a production or public environment.

## Summary

Aarav is a practical, voice-enabled counseling assistant for ITI admissions. It combines a clean React interface with a powerful Gemini-backed backend to deliver an engaging, real-time guidance experience for students exploring vocational education options.
