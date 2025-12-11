import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ESM-safe __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set! Add it in Render secrets.");
  process.exit(1);
}

// Init OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Conversation memory
let conversationHistory = [];

/* ------------------------------------------------
   🚀 HEALTH CHECK
------------------------------------------------ */
app.get("/api/ping", (req, res) => {
  res.json({ status: "online", time: Date.now() });
});

/* ------------------------------------------------
   🔥 MODEL WARM-UP (FIX 20s LAG)
------------------------------------------------ */
app.get("/api/warm", async (req, res) => {
  try {
    await openai.responses.create({
      model: "gpt-4o-mini",
      input: "hi"
    });
    res.json({ warmed: true });
  } catch (err) {
    console.error("Warm-up failed:", err);
    res.status(500).json({ warmed: false, error: err.message });
  }
});

/* ------------------------------------------------
   🤖 MAIN AI CHAT ROUTE
------------------------------------------------ */
const systemMessage = `You are the built-in AI assistant for this website. You behave like a normal powerful AI (GPT-4o-mini) and can answer ANY question: general knowledge, coding, math, explanations, advice, etc. 
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
• WORK EXPERIENCE → Role | Company | Year | Description
• EDUCATION → Degree | Institute | Year
• SKILLS → SkillName-Number, SkillName-Number (e.g., Python-90, JavaScript-60)
• LANGUAGES → english, hindi, french (comma-separated)
• HOBBIES → reading, coding, football (comma-separated)

TECHNOLOGIES USED TO BUILD THE WEBSITE:
HTML, CSS, JavaScript, Node.js, Express.js, and the OpenAI API.

Your Behavior:
- Act like a full-featured GPT-4o-mini AI for all questions.
- Try to keep responses short.
- Be helpful, smart, clear, and friendly.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: "No message provided" });

    conversationHistory.push({ role: "user", content: userMessage });

    // Limit last 6 messages for performance
    if (conversationHistory.length > 6) {
      conversationHistory = conversationHistory.slice(-6);
    }

    const conversationText =
      systemMessage +
      "\n\n" +
      conversationHistory.map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`).join("\n");

    const reply = await openai.responses.create({
      model: "gpt-4o-mini",
      input: conversationText
    });

    const aiReply = reply.output?.[0]?.content?.[0]?.text || "AI returned no text";

    conversationHistory.push({ role: "assistant", content: aiReply });

    res.json({ reply: aiReply });

  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ error: "AI error", details: err.message });
  }
});

/* ------------------------------------------------
   ROOT PAGE
------------------------------------------------ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ------------------------------------------------
   START SERVER
------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});
