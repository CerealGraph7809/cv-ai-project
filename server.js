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

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Conversation memory
let conversationHistory = [];

const websiteInfo = `You are the built-in AI assistant for this website. You behave like a normal powerful AI (GPT-4o-mini) and can answer ANY question: general knowledge, coding, math, explanations, advice, etc. 
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
- Be helpful, smart, clear, and friendly.`; // keep the full text as before

// AI route
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    conversationHistory.push({ role: "user", content: userMessage });

    let conversationText =
      `${websiteInfo}\n\nUser: ${userMessage}\n\nConversation so far:\n` +
      conversationHistory
        .map(msg =>
          msg.role === "user"
            ? `User: ${msg.content}`
            : `Assistant: ${msg.content}`
        )
        .join("\n");

    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: conversationText
    });

    const aiReply = completion.output[0].content[0].text;

    conversationHistory.push({ role: "assistant", content: aiReply });

    res.json({ reply: aiReply });

  } catch (error) {
    res.status(500).json({ error: "OpenAI API error", details: error.message });
  }
});

// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
