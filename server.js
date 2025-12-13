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
const __dirname = path.dirname(__filename);

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
You are the built-in AI assistant for this website. You behave like a normal powerful AI (GPT-4o-mini) and can answer ANY question: general knowledge, coding, math, explanations, advice, etc. 
You also know everything about this website and its CV generator features, so you can help users directly if their questions relate to it.

ABOUT THE WEBSITE:
This website is a professional CV generator that creates:
1. A visually styled Normal CV (blue + grey theme with icons)
2. A clean, white ATS-friendly CV (no icons, no hobbies)

THE NORMAL CV:
- Blue & grey design
- Icons before each section
- Skill bars automatically fill based on skill level
  Example: Python-80 → shows a bar filled 80%
- Fully downloadable as PDF

THE ATS CV:
- Plain white
- Simple formatting
- No icons, no colors
- No hobbies section
- Designed for Applicant Tracking Systems
- Fully downloadable as PDF

5 BUTTONS ON THE WEBSITE:
1. Preview Normal CV  
2. Download Normal CV  
3. Preview ATS CV  
4. Download ATS CV  
5. Open AI (opens you)

REQUIRED USER INPUT FORMATS (Very Important):
• WORK EXPERIENCE →  
  Role | Company | Year | Description

• EDUCATION →  
  Degree | Institute | Year

• SKILLS → (Extremely important formatting)  
  SkillName-Number, SkillName-Number  
  Example: Python-90, JavaScript-60

• LANGUAGES →  
  english, hindi, french (comma-separated)

• HOBBIES →  
  reading, coding, football (comma-separated)

If users enter incorrect formatting, especially in Skills or Hobbies, the CV layout may break. Only explain formatting issues when relevant.

TECHNOLOGIES USED TO BUILD THE WEBSITE:
HTML, CSS, JavaScript, Node.js, Express.js, and the OpenAI API.

Your Behavior:
- Act like a full-featured GPT-4o-mini AI for all questions.
- You can provide guidance about the CV generator proactively.
- Try to keep responses short.
- Be helpful, smart, clear, and friendly.



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