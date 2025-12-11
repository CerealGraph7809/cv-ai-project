import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

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
   🔥 MODEL WARM-UP (keeps AI fast)
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
- Skill bars automatically fill based on skill level (Example: Python-80 → bar filled 80%)
- Fully downloadable as PDF

THE ATS CV:
- Plain white
- Simple formatting
- No icons, no colors
- No hobbies section
- Fully downloadable as PDF

5 BUTTONS ON THE WEBSITE:
1. Preview Normal CV
2. Download Normal CV
3. Preview ATS CV
4. Download ATS CV
5. Open AI (opens you)

REQUIRED USER INPUT FORMATS:
• WORK EXPERIENCE → Role | Company | Year | Description
• EDUCATION → Degree | Institute | Year
• SKILLS → SkillName-Number, SkillName-Number (Example: Python-90, JavaScript-60)
• LANGUAGES → english, hindi, french (comma-separated)
• HOBBIES → reading, coding, football (comma-separated)

TECHNOLOGIES USED:
HTML, CSS, JavaScript, Node.js, Express.js, OpenAI API

Your Behavior:
- Full-featured GPT-4o-mini AI
- Keep responses short, helpful, clear, friendly
- Guide users proactively about CV generator
`;

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";

    conversationHistory.push({ role: "user", content: userMessage });

    if (conversationHistory.length > 6) {
      conversationHistory = conversationHistory.slice(-6);
    }

    const conversationText =
      systemMessage +
      "\n\n" +
      conversationHistory
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n");

    let aiReply = "";

    try {
      const reply = await openai.responses.create({
        model: "gpt-4o-mini",
        input: conversationText
      });

      if (
        reply.output &&
        reply.output[0] &&
        reply.output[0].content &&
        reply.output[0].content[0] &&
        reply.output[0].content[0].text
      ) {
        aiReply = reply.output[0].content[0].text;
      } else {
        aiReply = "Sorry, I couldn't generate a response. Please try again.";
      }
    } catch (apiErr) {
      console.error("OpenAI API error:", apiErr);
      aiReply = "AI service temporarily unavailable. Check API key or billing.";
    }

    conversationHistory.push({ role: "assistant", content: aiReply });

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("Server error:", err);
    res.json({ reply: "Internal server error. Please try again." });
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
