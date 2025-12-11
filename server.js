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

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));

// Init OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Keep last 6 messages for conversation memory
let conversationHistory = [];

/* ------------------------------------------------
   🚀 HEALTH CHECK
------------------------------------------------ */
app.get("/api/ping", (req, res) => {
  res.json({ status: "online", time: Date.now() });
});

/* ------------------------------------------------
   🔥 REAL MODEL WARM-UP (REDUCES FIRST MESSAGE LAG)
------------------------------------------------ */
app.get("/api/warm", async (req, res) => {
  try {
    await openai.responses.create({
      model: "gpt-4o-mini",
      input: "hi"
    });
    res.json({ warmed: true });
  } catch (err) {
    console.error("Warm-up error:", err);
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
- Skill bars automatically fill based on skill level (Python-80 → bar filled 80%)
- Fully downloadable as PDF

THE ATS CV:
- Plain white, simple formatting, no icons, no hobbies
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
• SKILLS → SkillName-Number, SkillName-Number (e.g., Python-90, JavaScript-60)
• LANGUAGES → english, hindi, french (comma-separated)
• HOBBIES → reading, coding, football (comma-separated)

TECHNOLOGIES USED:
HTML, CSS, JavaScript, Node.js, Express.js, and OpenAI API.

Your Behavior:
- Be helpful, clear, and friendly
- Short and precise responses
`;

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: "No message provided" });

    // Save memory
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 6) conversationHistory = conversationHistory.slice(-6);

    const conversationText =
      systemMessage +
      "\n\n" +
      conversationHistory
        .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n");

    // OpenAI request
    const reply = await openai.responses.create({
      model: "gpt-4o-mini",
      input: conversationText
    });

    // Safely extract AI text
    let aiReply = "Sorry, I couldn't generate a response.";
    if (
      reply &&
      reply.output &&
      reply.output[0] &&
      reply.output[0].content &&
      reply.output[0].content[0] &&
      reply.output[0].content[0].text
    ) {
      aiReply = reply.output[0].content[0].text;
    }

    conversationHistory.push({ role: "assistant", content: aiReply });

    res.json({ reply: aiReply });

  } catch (err) {
    console.error("Chat error:", err);
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
app.listen(PORT, () => console.log(`🔥 Server running on ${PORT}`));
