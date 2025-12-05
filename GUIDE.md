Digital Playbook Coach — Instructional Guide

Overview

This prototype demonstrates how an AI-driven Digital Playbook Tutor could support linebackers studying their defensive playbook. The web prototype runs entirely in the browser and simulates AI responses with templated feedback. It is intended as a mock-up for your assignment and to show interaction patterns (flashcards, quizzes, scenario drills, diagrams, prompt logging).

Quick Start

1. Start a local static server from the project folder (recommended):

```bash
cd ~/Desktop/DIGITAL_PLAYBOOK_COACH
python3 -m http.server 8000
```

2. Open the site in a browser: `http://localhost:8000/index.html`.

Features

- Playbook Explorer: View loaded plays. Import a playbook JSON file (supports either `{ "plays": [...] }` or a plain array).
- Diagram Upload: Upload play diagrams (images) and tag them to specific plays. Diagrams are stored in browser `localStorage` and displayed in the Diagram Gallery and on play cards.
- Flashcards: Generate flashcards automatically from play fields (coverage, blitz). Flip / navigate cards to study.
- Quiz: Run a randomized multiple-choice quiz derived from loaded plays. The prototype provides immediate correctness feedback and a short AI-like summary recorded in the Prompt Log.
- Scenario Drill: Generates a short scenario based on a random play and asks the user to choose a response; the prototype provides templated feedback.
- Prompts Log: Records prompts and generated responses (simulated) so you can show how prompt engineering evolves.

Example Prompts (for your assignment log)

Below are example prompts you could show in your report. The prototype records simplified prompt/response entries in the Prompts Log UI.

- "Create a flashcard: What is the coverage for 'Base Cover 3'?" — Expected: "Cover 3 Zone"
- "Generate a scenario: Offense shows trips right; as Mike, what is your primary responsibility?" — Expected: "Rotate to middle coverage / read RB"
- "Explain why the Mike should drop into the middle-third on Cover 3." — Expected: "To protect against deep mid-range seam routes and balance against outside leverage."
- "Refine prompt: Make explanation concise and add a coaching cue for run fits." — Shows how prompts can be refined for clarity.

Prompt Refinement Log (example)

1) Initial prompt: "Explain Mike's responsibility on Base Cover 3"
   - AI output: long paragraph, coach language.
2) Refined prompt: "Explain Mike's responsibility on Base Cover 3 in 2 sentences and include a short run-fit cue."
   - AI output: concise explanation + run-fit cue — clearer for players.

Notes on Diagram Support

- This prototype stores images as base64 data URLs in the browser. For production you would store diagrams in a server or cloud bucket and keep metadata (play tag, notes) in a database.
- You can tag diagrams to plays. Consider adding an annotation overlay (X/Y tap points) if you want interactive breakdowns of responsibilities on the diagram.

Next Steps (recommended for a stronger demo)

- Hook to a real LLM (OpenAI, Anthropic) via a backend to generate varied, context-rich scenarios and longer explanations. Keep API keys on the server; do not embed them in client JS.
- Add user accounts and persistent performance tracking (backend or Firebase) to enable adaptive learning paths.
- Add an annotation tool for diagrams (click-to-add role labels) and export annotated diagrams as teaching cards.
- Expand play ingestion: parse coach notes (PDF/Word) into structured JSON, or provide a small form that coaches can use to add plays via a guided UI.

Files changed in the prototype

- `index.html` — UI: Playbook, Flashcards, Quiz, Scenario Drill, Prompts Log, Diagram Gallery
- `script.js` — Frontend logic for plays, flashcards, quizzes, scenario simulation, diagram upload, prompt logging
- `plays.json` — Sample plays expanded for linebacker-focused fields
- `style.css` — Styling for UI and flashcards

If you want, I can now:
- (A) Integrate a backend and OpenAI to produce real AI outputs (requires an API key and server). 
  
Server setup (how to run the included backend proxy)

1. Install dependencies and add your OpenAI key (from OpenAI dashboard).

```bash
cd ~/Desktop/DIGITAL_PLAYBOOK_COACH
# install npm dependencies
npm install
# copy example env and add your API key
cp .env.example .env
# then edit .env and replace OPENAI_API_KEY value
```

2. Start the server (default port 3000):

```bash
npm start
```

3. Open the frontend in your browser (the frontend will request the backend on the same host):

http://localhost:3000/index.html

Notes:
- The server provides POST `/api/generate` which the frontend uses to ask the LLM for scenarios and explanations.
- Do not commit your `.env` file or your API key to source control.
- (B) Create a downloadable PDF of this Instructional Guide and the prompt log examples for submission.
- (C) Add annotation tools for diagrams (click-to-add labeled points) in the browser.

Tell me which of (A)/(B)/(C) you want next, or ask me to refine any part of the guide for your assignment write-up.
