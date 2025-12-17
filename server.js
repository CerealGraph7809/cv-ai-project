import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

/* ------------------------------------------------
   FIX __dirname FOR ESM
------------------------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------
   APP SETUP
------------------------------------------------ */
const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------------------------
   OPENAI CLIENT (SAFE)
------------------------------------------------ */
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY IS MISSING");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ------------------------------------------------
   MEMORY
------------------------------------------------ */
const sessions = new Map();
const MAX_MESSAGES = 6;
const SESSION_TTL = 30 * 60 * 1000;

// cleanup old sessions
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL) {
      sessions.delete(sid);
    }
  }
}, 10 * 60 * 1000);

/* ------------------------------------------------
   PING / WARM
------------------------------------------------ */
app.get("/api/ping", (req, res) => {
  res.json({ status: "online", time: Date.now() });
});

app.get("/api/warm", (req, res) => {
  res.json({ status: "awake", time: Date.now() });
});

/* ------------------------------------------------
   SYSTEM MESSAGE
------------------------------------------------ */
const systemMessage = {
  role: "system",
  content: `
You are the built-in AI assistant for a professional CV generator website.
You can answer ANY question.

Website:
- Normal CV: blue/grey, icons, skill bars, PDF
- ATS CV: white, no icons, ATS-friendly, PDF

Input formats:
Work: Role | Company | Year | Description
Education: Degree | Institute | Year
Skills: Skill-Number (e.g. Python-80)

Be helpful, clear, friendly, and concise.
`
};

/* ------------------------------------------------
   CHAT ROUTE (BULLETPROOF)
------------------------------------------------ */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "No message provided." });
    }

    const sid = sessionId || crypto.randomUUID();

    if (!sessions.has(sid)) {
      sessions.set(sid, {
        messages: [],
        lastUsed: Date.now()
      });
    }

    const session = sessions.get(sid);
    session.lastUsed = Date.now();

    session.messages.push({ role: "user", content: message });

    if (session.messages.length > MAX_MESSAGES) {
      session.messages.splice(0, session.messages.length - MAX_MESSAGES);
    }

    const messages = [systemMessage, ...session.messages];

    // 🔥 OpenAI call
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: messages,
      max_output_tokens: 300
    });

    // ✅ SAFE extraction
    const reply =
      response?.output?.[0]?.content?.[0]?.text ??
      "AI responded with no text.";

    session.messages.push({ role: "assistant", content: reply });

    res.json({ reply, sessionId: sid });

  } catch (err) {
    // 🔍 REAL ERROR LOGGING
    console.error("🔥 OPENAI ERROR DETAILS:");
    console.error(err?.status, err?.message, err?.error);

    res.status(500).json({
      reply: err?.message || "OpenAI request failed"
    });
  }
});

/* ------------------------------------------------
   ROOT
------------------------------------------------ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ------------------------------------------------
   404 (LAST)
------------------------------------------------ */
app.use((req, res) => {
  res.status(404).send("Not Found");
});

/* ------------------------------------------------
   START
------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});
