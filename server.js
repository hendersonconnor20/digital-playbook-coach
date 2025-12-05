/* Small Express server to proxy requests to OpenAI.
   Usage: set OPENAI_API_KEY in environment (see .env.example)
*/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set. Set it in your environment or .env file.");
}

const hasKey = Boolean(OPENAI_KEY && OPENAI_KEY.length > 10);
let openai = null;
if (hasKey) {
  openai = new OpenAI({ apiKey: OPENAI_KEY });
} else {
  console.warn("OPENAI_API_KEY not provided — server will use simulated AI responses.");
}

// Serve frontend static files from project root so the app is available at /index.html
app.use(express.static(path.resolve(".")));

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, max_tokens = 400 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt in request body." });
    if (hasKey && openai) {
      // Make a chat completion request using the configured OpenAI client
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an experienced football coach and tutor. Provide concise, actionable teaching feedback for a college linebacker. When giving answers, include a short explanation and a coaching cue." },
          { role: "user", content: prompt }
        ],
        max_tokens,
        temperature: 0.6
      });

      const text = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
        ? response.choices[0].message.content
        : "(no response)";

      res.json({ reply: text });
    } else {
      // Simulated fallback response when no API key is available
      // Generate a short, coach-like reply based on the prompt (templated)
      const simulated = generateSimulatedReply(prompt);
      // respond with both a human-readable reply and a structured object
      res.json({ reply: simulated.text, structured: simulated.structured });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

function generateSimulatedReply(prompt) {
  // Very small heuristic templated reply: try to extract play name or give a generic coaching cue
  let playMatch = null;
  try {
    const m = prompt.match(/"?name"?:\s*"?([A-Za-z0-9 _-]{3,30})"?/i);
    if (m) playMatch = m[1];
  } catch (e) {}
  const playLabel = playMatch ? ` (${playMatch.trim()})` : "";
  const scenario = `Offense shows a standard set${playLabel}. As the Mike (MLB), read the QB drop and protect the middle third.`;
  const options = [
    "Drop to middle-third",
    "Attack A-gap",
    "Spy the running back"
  ];
  const correctIndex = 0;
  const explanation = "Middle-third coverage defends seam routes and prevents big plays down the middle.";
  const coachingCue = "Eyes on QB, plant and sink to the hook zone; read WR stems.";
  const text = `SIMULATED AI${playLabel}: Scenario: ${scenario}\nOptions: A) ${options[0]}  B) ${options[1]}  C) ${options[2]}\nCorrect: ${String.fromCharCode(65 + correctIndex)}\nExplanation: ${explanation} Coaching cue: ${coachingCue}`;
  return {
    text,
    structured: {
      scenario,
      options,
      correctIndex,
      explanation,
      coachingCue,
    }
  };
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} — POST /api/generate`);
});
