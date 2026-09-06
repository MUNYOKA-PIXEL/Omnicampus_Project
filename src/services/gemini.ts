import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODELS = [
  { name: "gemini-1.5-flash", version: "v1" },
  { name: "gemini-1.5-flash-8b", version: "v1" },
  { name: "gemini-1.5-pro", version: "v1" },
  { name: "gemini-2.0-flash", version: "v1beta" },
];

export const generateCampusResponse = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userPrompt: z.string().min(1).max(4000),
      userProfile: z
        .object({
          course: z.string().nullable().optional(),
          year_of_study: z.number().nullable().optional(),
        })
        .optional(),
      context: z.object({
        availableBooks: z.array(z.string()),
        upcomingEvents: z.array(z.string()),
        medicalAvailability: z.array(z.string()),
        recentLostFound: z.array(z.string()),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Omni-Intelligence] GEMINI_API_KEY is not configured.");
      return "The AI Agent is not configured. Please contact your USIU system administrator.";
    }

    const systemPrompt = `
      You are Omni-Intelligence, the official USIU-Africa Campus Agent.
      Your goal is to help students navigate campus life efficiently.

      Student Profile:
      - Course: ${data.userProfile?.course || "Not specified"}
      - Year of Study: ${data.userProfile?.year_of_study || "Not specified"}

      Current Campus Context (REAL-TIME DATA):
      - Available Books: ${data.context.availableBooks.join(", ") || "None currently listed"}
      - Upcoming Events: ${data.context.upcomingEvents.join(", ") || "None scheduled"}
      - Doctors Available: ${data.context.medicalAvailability.join(", ") || "No doctors currently available"}
      - Recent Lost & Found: ${data.context.recentLostFound.join(", ") || "No recent reports"}

      Guidelines:
      1. Be professional, helpful, and energetic.
      2. Use USIU-Africa and OmniCampus terminology.
      3. Use the "Current Campus Context" above to answer questions accurately.
      4. If a student asks for something not in the context, politely explain you don't see it in the current records.
      5. NEVER ask for Student IDs or private UUIDs.
    `;

    const lastErrors: string[] = [];
    for (const config of MODELS) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel(
          { model: config.name },
          { apiVersion: config.version as "v1" | "v1beta" },
        );
        const result = await model.generateContent([
          { text: systemPrompt },
          { text: `User Question: ${data.userPrompt}` },
        ]);
        return result.response.text();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Gemini Fallback] Model ${config.name} failed:`, message);
        lastErrors.push(`${config.name}: ${message}`);
      }
    }

    console.error("[USIU Campus Agent] All models failed:", lastErrors[0]);
    return "Connection Error: I'm having trouble accessing USIU campus data right now. Please try again later.";
  });
