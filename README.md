Digital Playbook Coach — Prototype

This project is a browser-based prototype of an AI-assisted playbook tutor for linebackers.

Quick start (development)

1. Install dependencies and set your OpenAI API key:

```bash
cd ~/Desktop/DIGITAL_PLAYBOOK_COACH
npm install
cp .env.example .env
# Edit .env and paste your OpenAI API key
```

2. Start the server (this serves the frontend and proxies requests to OpenAI):

```bash
npm start
```

3. Open the app in your browser:

http://localhost:3000/index.html

Security note

- Keep your OpenAI API key private. Do not commit `.env` to source control.

Files added/changed

- `server.js` — Express server that exposes a simple POST `/api/generate` endpoint which forwards prompts to OpenAI.
- `package.json` — Node dependencies and start scripts.
- `.env.example` — environment example file.
- Frontend files updated to call the backend and show AI-generated scenarios.

If you want, I can:
- Add server-side logging of prompt usage (for an assignment log).
- Add authentication if you plan to share the demo with others.
