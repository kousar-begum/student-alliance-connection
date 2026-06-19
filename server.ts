import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely to allow graceful mock mode if API key is missing
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    return aiClient;
  } catch (err) {
    console.error("Error setting up Gemini Client:", err);
    return null;
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiEnabled: !!process.env.GEMINI_API_KEY });
});

// Route 1: AI Resume Analyzer
app.post("/api/ai/resume-analyze", async (req, res) => {
  const { resumeText, targetRole } = req.body;
  if (!resumeText) {
    res.status(400).json({ error: "No resume text provided" });
    return;
  }

  const client = getAIClient();
  if (!client) {
    // Demonstration fallback
    setTimeout(() => {
      res.json({
        score: 82,
        positives: [
          "Strong programming languages stack including TypeScript and Python.",
          "Clear description of academic projects illustrating responsive layout design.",
          "Solid education details from a top-tier institution with a highly competitive GPA."
        ],
        improvements: [
          "Lack of detailed metric quantification (e.g. state 'improved efficiency by 30%' instead of just 'improved efficiency').",
          "Include section on testing methodologies (e.g., Jest, Cypress, or React Testing Library).",
          "Could add database system optimizations since you list backend node.js."
        ],
        tailoredAdvice: `To target a specialized ${targetRole || 'Software Engineering'} opportunity, emphasize developer tools familiarity in your project details. Clearly state how you chose spacing parameters and custom transition speeds when explaining your React work. Consider adding a section highlighting version control (Git) workflow.`
      });
    }, 1000);
    return;
  }

  try {
    const prompt = `Analyze the following resume text specifically targeting the role of "${targetRole || 'Software Engineer'}".
Evaluate the strengths, list areas of critical improvement, and write tailored advice.
Return a structured output with:
1. Overall score (0-100)
2. List of 3 key strengths/positives
3. List of 3 key improvement areas
4. Paragraph of tailored career advice

Resume Text:
${resumeText}`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Resume evaluation score between 0 and 100" },
            positives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 3 strong points/positives"
            },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 3 critical suggestions for improvement"
            },
            tailoredAdvice: { type: Type.STRING, description: "A detailed paragraph of tactical career guidance" }
          },
          required: ["score", "positives", "improvements", "tailoredAdvice"]
        }
      }
    });

    const resultText = response.text;
    if (resultText) {
      res.json(JSON.parse(resultText.trim()));
    } else {
      throw new Error("No response output from Gemini model");
    }
  } catch (error: any) {
    console.error("Gemini Resume Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze resume with AI" });
  }
});

// Route 2: conversational Career Guidance Counselor
app.post("/api/ai/career-guidance", async (req, res) => {
  const { messages, studentProfile } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Incompatible messages structure" });
    return;
  }

  const client = getAIClient();
  if (!client) {
    // Demonstration fallback
    setTimeout(() => {
      res.json({
        text: "That is a great direction! Since you have solid frontend skills with React and Tailwind CSS, I highly recommend building and publishing a personal design module. Companies like Stripe love to see developers who understand typographic alignment, negative vertical margins, and performance optimization on animations. What specific sub-fields (like Fintech, AI tooling, or Cloud platforms) excite you most?"
      });
    }, 800);
    return;
  }

  try {
    const chatHistory = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    // Inject system guide at the beginning of chat context
    const introText = `You are an elite Career Coach and Academic Advisor named mentor.
The student profile you are assisting is:
Name: ${studentProfile?.fullName || 'Anonymous'}
University: ${studentProfile?.collegeName || 'A top tier college'}
Major: ${studentProfile?.major || 'Computer Science'}
Skills: ${(studentProfile?.skills || []).join(", ")}
Bio: ${studentProfile?.bio || 'Looking to learn'}

Structure your conversations to guide, encourage, and offer tangible actions. Ensure answers are under 3-4 short paragraphs. Keep your style modern, sophisticated, and pragmatic.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: introText }] },
        { role: "model", parts: [{ text: "Understood. I am set up as their private Career Advisor. How can I help Jamie Vance today?" }] },
        ...chatHistory
      ]
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Guidance Error:", error);
    res.status(500).json({ error: error.message || "Guidance error" });
  }
});

// Route 3: Interview Prep (Tailored mock question & interactive response scoring)
app.post("/api/ai/interview-prep", async (req, res) => {
  const { company, position, history, userResponse } = req.body;
  if (!company || !position) {
    res.status(400).json({ error: "Company name and Job position are required." });
    return;
  }

  const client = getAIClient();
  if (!client) {
    // Falls back to mock feedback or question based on request
    if (!userResponse) {
      res.json({
        question: `How would you handle global state synchronization in a high-fidelity React application at ${company}? Specifically, detail your strategies to avoid redundant re-renders and stabilize rendering performance when introducing many nested responsive widgets.`,
        isFeedback: false
      });
    } else {
      res.json({
        isFeedback: true,
        score: 85,
        feedbackText: `Your answer highlights important considerations about localized state and reference caching. You successfully identified that lifting state unnecessarily causes render cascades. Good work specifying Tailwind responsivenes, though you could describe memoization hooks in greater depth.`,
        suggestedBetterAnswer: `To prevent re-renders, declare and stabilize state at the exact node of intersection. Utilize useMemo and useCallback to wrap functions and heavy objects. If implementing complex timelines, leverage native React state or durable localStorage sync combined with custom observer layers instead of a heavyweight context wrapper that triggers updates globally across all frames.`,
        nextQuestion: `Terrific. Based on that, how would you design an API rate limiter client-side when polling status from our microservices at ${company}?`
      });
    }
    return;
  }

  try {
    if (!userResponse) {
      // Step A: Generate tailored Question
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Generate a highly specific, customized interview question for a "${position}" candidate applying at "${company}".
The focus of the question should test their alignment, technical capability, or situational analysis.
Provide ONLY the interview question text. Keep it challenging, direct, and under 3 sentences.`,
      });
      res.json({ question: response.text?.trim(), isFeedback: false });
    } else {
      // Step B: Grade their response and provide feedback and followup
      const prompt = `Grade the candidate's response to an interview question.
Company: "${company}"
Position: "${position}"
Proposed response to evaluate:
"${userResponse}"

Return a structured JSON output with:
1. Overall candidate score (0-100) for this answer.
2. Short paragraph of critical, professional feedback evaluating correctness and completeness.
3. An example of an elite, model answer (1-2 paragraphs max).
4. A tactical next follow-up question related to this topic or company role.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              feedbackText: { type: Type.STRING },
              suggestedBetterAnswer: { type: Type.STRING },
              nextQuestion: { type: Type.STRING }
            },
            required: ["score", "feedbackText", "suggestedBetterAnswer", "nextQuestion"]
          }
        }
      });

      const resultText = response.text;
      if (resultText) {
        const payload = JSON.parse(resultText.trim());
        res.json({ ...payload, isFeedback: true });
      } else {
        throw new Error("No interview response evaluation from model");
      }
    }
  } catch (error: any) {
    console.error("Gemini Interview Error:", error);
    res.status(500).json({ error: error.message || "Failed interview prep API" });
  }
});

// Route 4: AI Job Matching
app.post("/api/ai/job-matching", async (req, res) => {
  const { resumeText, jobs } = req.body;
  if (!resumeText || !jobs || !Array.isArray(jobs)) {
    res.status(400).json({ error: "Missing resume or jobs array parameters." });
    return;
  }

  const client = getAIClient();
  if (!client) {
    // Demonstration fallback
    const matches = jobs.map((job: any, index: number) => {
      let fitScore = 65 + (index * 7) % 30; // some varied scores
      let highlights = ["Technical alignment on primary stack", "Education matches timeline"];
      let advice = "Strengthen experience with cloud systems to increase score.";
      if (job.title.includes("Software Engineering")) {
        fitScore = 90;
        highlights = [
          "Direct match for Computer Science academic background",
          "Includes strong systems languages and logic skills",
          "Active interest in scalable distributed systems"
        ];
        advice = "Highlight backend structures and add details regarding Docker/Kubernetes exposure.";
      } else if (job.title.includes("Product Designer") || job.title.includes("Design")) {
        fitScore = 82;
        highlights = [
          "Explicitly listed Frontend React and Tailwind expertise",
          "Matches design-driven software philosophy in bio",
          "Strong portfolio of glassmorphic assets"
        ];
        advice = "Present interactive layout prototypes and micro-transitions in your interview deck.";
      }
      return { jobId: job.id, fitScore, matchReasonHighlights: highlights, skillGapAdvice: advice };
    });
    setTimeout(() => { res.json({ matches }); }, 1100);
    return;
  }

  try {
    const jobsSummary = jobs.map((j: any) => `ID: ${j.id}, Title: ${j.title}, Company: ${j.company}, Requirements: ${j.requirements.join(", ")}`).join("\n---\n");
    const prompt = `You are a career matcher. Analyze this candidate resume and matching candidate to each prospective job.
For each job in the list, compute:
1. Overall fit percentage score (0-100)
2. Array of 2-3 reasons for the match
3. Exactly one solid piece of skill gap advice to increase their candidacy.

Resume Text:
${resumeText}

List of Jobs (ID and Details):
${jobsSummary}`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  jobId: { type: Type.STRING, description: "The matching Job ID provided" },
                  fitScore: { type: Type.INTEGER, description: "Fit score out of 100" },
                  matchReasonHighlights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "2-3 precise bullet points explaining why they fit"
                  },
                  skillGapAdvice: { type: Type.STRING, description: "Tactical advice to close gaps" }
                },
                required: ["jobId", "fitScore", "matchReasonHighlights", "skillGapAdvice"]
              }
            }
          },
          required: ["matches"]
        }
      }
    });

    const resultText = response.text;
    if (resultText) {
      res.json(JSON.parse(resultText.trim()));
    } else {
      throw new Error("No response output from Gemini job-matching model");
    }
  } catch (error: any) {
    console.error("Gemini Job Matching Error:", error);
    res.status(500).json({ error: error.message || "FAILED_MATCHING_AI" });
  }
});

// Route 5: Interactive Mentor Chat (Gemini roles as alumni!)
app.post("/api/ai/mentor-chat", async (req, res) => {
  const { mentorName, mentorCompany, mentorRole, studentProfile, messages } = req.body;
  if (!mentorName || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Missing conversation details." });
    return;
  }

  const client = getAIClient();
  if (!client) {
    const defaultRes = mentorName.includes("Sterling")
      ? "I read through your project details Jamie! Google Cloud is indeed doing some groundbreaking engineering to reduce network jitter. I'd be glad to set up a Zoom mock review. If your algorithms are sharp and you are comfortable with concurrency patterns, we can definitely look into queuing a referral. Let me know when you are free!"
      : `Hi, thank you for reaching out! In my day-to-day role here at ${mentorCompany || "Stripe"}, I see that candidates who combine technical layout understanding with aesthetic precision really stand out. Yes, I'd love to review your portfolios. Let's start with your Figma workflows!`;
    setTimeout(() => { res.json({ text: defaultRes }); }, 900);
    return;
  }

  try {
    const chatHistory = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const systemContext = `You are playing the role of ${mentorName}, a vetted alumni mentor who graduated from the student's university.
You currently work as a ${mentorRole || 'Professional'} at ${mentorCompany || 'a high tech firm'}.
The student you are talking to is:
Name: ${studentProfile?.fullName || 'Jamie Vance'}
University: ${studentProfile?.collegeName || 'Stanford'}
Major: ${studentProfile?.major || 'Computer Science'}
Skills: ${(studentProfile?.skills || []).join(", ")}

Respond to the student's questions in-character as an encouraging, professional, and slightly seasoned mentor. Talk about your company culture, provide constructive career advice, and discuss their referrals. Keep answers realistic, friendly, conversational, and under certain paragraphs. Do not mention you are an AI model.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemContext }] },
        { role: "model", parts: [{ text: `Understood. I am now in character as ${mentorName} at ${mentorCompany}. I will greet Jamie and reply naturally.` }] },
        ...chatHistory
      ]
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Mentor Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed Mentor chat stream" });
  }
});


// ----------------------------------------------------
// FRONTEND SERVING
// ----------------------------------------------------

async function startFrontendServing() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startFrontendServing();
