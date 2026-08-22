// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCampusContext } from "./campusContext";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const MODELS = [
  { name: "gemini-1.5-flash", version: "v1" },
  { name: "gemini-1.5-flash-8b", version: "v1" },
  { name: "gemini-1.5-pro", version: "v1" },
  { name: "gemini-2.0-flash", version: "v1beta" },
];

export const generateCampusResponse = async (
  userPrompt: string, 
  userProfile?: { course?: string | null; year_of_study?: number | null }, 
  userId?: string
) => {
  try {
    if (!GEMINI_API_KEY) {
      console.error("[Omni-Intelligence] API Key not found.");
      return "The AI Agent's API Key is missing. Please contact your USIU system administrator.";
    }

    const context = await getCampusContext();
    
    const systemPrompt = `
      You are Omni-Intelligence, the official USIU-Africa Campus Agent. 
      Your goal is to help students navigate campus life efficiently.

      Student Profile:
      - Course: ${userProfile?.course || "Not specified"}
      - Year of Study: ${userProfile?.year_of_study || "Not specified"}

      Current Campus Context (REAL-TIME DATA):
      - Available Books: ${context.availableBooks.join(", ") || "None currently listed"}
      - Upcoming Events: ${context.upcomingEvents.join(", ") || "None scheduled"}
      - Doctors Available: ${context.medicalAvailability.join(", ") || "No doctors currently available"}
      - Recent Lost & Found: ${context.recentLostFound.join(", ") || "No recent reports"}

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
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: config.name }, { apiVersion: config.version as any });

        const result = await model.generateContent([
          { text: systemPrompt },
          { text: `User Question: ${userPrompt}` }
        ]);
        
        return result.response.text();
      } catch (e: unknown) {
        const error = e as Error;
        console.warn(`[Gemini Fallback] Model ${config.name} failed:`, error.message);
        lastErrors.push(`${config.name}: ${error.message}`);
        continue; 
      }
    }

    throw new Error(`All AI models failed. Last error: ${lastErrors[0]}`);
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[USIU Campus Agent] Final Error:", err);
    return `Connection Error: ${err.message}. I'm having trouble accessing USIU campus data right now. Please try again later.`;
  }
};