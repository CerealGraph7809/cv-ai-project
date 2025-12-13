import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

/* ------------------------------------------------
   FIX __dirname FOR ESM (RENDER SAFE)
------------------------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

/* ------------------------------------------------
   APP SETUP
------------------------------------------------ */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------------------------
   OPENAI INIT
------------------------------------------------ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ------------------------------------------------
   🧠 PER-USER MEMORY (NO MIXING)
------------------------------------------------ */
const sessions = new Map();
const MAX_MESSAGES = 6;

/* ------------------------------------------------
   🚀 HEALTH CHECK (UPTIMEROBOT)
------------------------------------------------ */
app.get("/api/ping", (req, res) => {
  res.json({ status: "online", time: Date.now() });
});

/* ------------------------------------------------
   🔥 MODEL WARM-UP (FIXES FIRST MESSAGE LAG)
------------------------------------------------ */
app.get("/api/warm", async (req, res) => {
  try {
    await openai.responses.create({
      model: "gpt-4o-mini",
      input: "ping"
    });
    res.json({ warmed: true });
  } catch (err) {
    res.json({ warmed: false, error: err.message });
  }
});

/* ------------------------------------------------
   🤖 SYSTEM MESSAGE (FULL WEBSITE INFO)
------------------------------------------------ */
const systemMessage = `
You are the built-in AI assistant for this website.
You behave like a powerful general-purpose AI (GPT-4o-mini).

You can answer ANY question:
- general knowledge
- coding
- math
- explanations
- advice
- CV-related help

ABOUT THE WEBSITE:
This website is a professional CV generator that creates:

1) NORMAL CV
- Blue & grey theme
- Icons before sections
- Skill bars auto-fill based on skill level
  Example: Python-80 → 80% filled bar
- Downloadable as PDF

2) ATS CV
- Plain white
- No icons
- No colors
- No hobbies section
- ATS-friendly
- Downloadable as PDF

WEBSITE BUTTONS:
1. Preview Normal CV
2. Download Normal CV
3. Preview ATS CV
4. Download ATS CV
5. Open AI (you)

REQUIRED INPUT FORMATS:
• WORK EXPERIENCE:
  Role | Company | Year | Description

• EDUCATION:
  Degree | Institute | Year

• SKILLS (VERY IMPORTANT):
  Skill-Number, Skill-Number
  Example: Python-90, JavaScript-60

• LANGUAGES:
  english, hindi, french

• HOBBIES:
  reading, coding, football

Warn users only when formatting breaks layout.

TECH STACK:
HTML, CSS, JavaScript, Node.js, Express.js, OpenAI API

BEHAVIOR:
- Be helpful
- Be clear
- Keep responses short
- Be friendly
`;

/* ------------------------------------------------
   🤖 MAIN CHAT ROUTE (PER USER MEMORY)
------------------------------------------------ */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message)
      return res.status(400).json({ error: "No message provided" });

    // Generate sessionId if missing
    const sid = sessionId || crypto.randomUUID();

    // Init memory for user
    if (!sessions.has(sid)) {
      sessions.set(sid, []);
    }

    const history = sessions.get(sid);

    // Add user message
    history.push({ role: "user", content: message });

    // Limit memory (prevents slowdown)
    if (history.length > MAX_MESSAGES) {
      history.splice(0, history.length - MAX_MESSAGES);
    }

    // Build prompt
    const prompt =
      systemMessage +
      "\n\n" +
      history
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");

    // OpenAI call
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });

    const aiReply = response.output[0].content[0].text;

    // Save assistant reply
    history.push({ role: "assistant", content: aiReply });

    res.json({
      reply: aiReply,
      sessionId: sid
    });

  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.status(500).json({
      error: "AI service temporarily unavailable"
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
   START SERVER
------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});