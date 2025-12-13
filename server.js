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
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------------------------
   OPENAI
------------------------------------------------ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ------------------------------------------------
   MEMORY
------------------------------------------------ */
const sessions = new Map();
const MAX_MESSAGES = 6;

/* ------------------------------------------------
   HEALTH CHECK
------------------------------------------------ */
app.get("/api/ping", (req, res) => {
  res.json({ status: "online", time: Date.now() });
});

/* ------------------------------------------------
   SYSTEM MESSAGE
------------------------------------------------ */
const systemMessage = {
  role: "system",
  content: `
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

- `
};

/* ------------------------------------------------
   CHAT ROUTE
------------------------------------------------ */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "No message" });
    }

    const sid = sessionId || crypto.randomUUID();

    if (!sessions.has(sid)) {
      sessions.set(sid, []);
    }

    const history = sessions.get(sid);

    history.push({ role: "user", content: message });

    if (history.length > MAX_MESSAGES) {
      history.splice(0, history.length - MAX_MESSAGES);
    }

    const messages = [systemMessage, ...history];

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: messages
    });

    const reply = response.output_text;

    history.push({ role: "assistant", content: reply });

    res.json({ reply, sessionId: sid });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});

/* ------------------------------------------------
   ROOT
------------------------------------------------ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ------------------------------------------------
   START
------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});
