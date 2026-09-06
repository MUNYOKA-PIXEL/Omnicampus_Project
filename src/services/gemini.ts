import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MODELS = [
  { name: "gemini-3.6-flash", version: "v1beta" },
  { name: "gemini-3.6-pro", version: "v1beta" },
];

const agentArgsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

const agentStepSchema = z.object({
  type: z.enum(["final", "tool_call"]),
  message: z.string().default(""),
  tool: z.string().optional(),
  args: agentArgsSchema.default({}),
  requiresConfirmation: z.boolean().default(false),
});

const roleSchema = z.enum(["superadmin", "student", "libadmin", "medadmin", "clubadmin"]);

async function getAuthenticatedAgentContext(accessToken?: string) {
  const authorization = getRequestHeader("authorization");
  const token = accessToken || authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!token || !supabaseUrl || !supabaseKey) return null;

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
    supabase.from("profiles").select("course, year_of_study").eq("id", userData.user.id).maybeSingle(),
  ]);
  const rolePriority = ["superadmin", "libadmin", "medadmin", "clubadmin", "student"];
  const role = rolePriority.find((candidate) => roleRows?.some((row) => row.role === candidate));

  return {
    userId: userData.user.id,
    role: roleSchema.parse(role ?? "student"),
    userProfile: profile ?? undefined,
  };
}

function cleanAssistantResponse(response: string): string {
  return response
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{1,3}|_{1,3}|`/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAgentStep(response: string) {
  const normalized = response.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return agentStepSchema.parse(JSON.parse(normalized));
}

export const runCampusAgentStep = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userPrompt: z.string().min(1).max(4000),
      accessToken: z.string().min(20),
      userProfile: z
        .object({
          course: z.string().nullable().optional(),
          year_of_study: z.number().nullable().optional(),
        })
        .optional(),
      role: z.enum(["superadmin", "student", "libadmin", "medadmin", "clubadmin"]),
      context: z.object({
        availableBooks: z.array(z.string()),
        upcomingEvents: z.array(z.string()),
        medicalAvailability: z.array(z.string()),
        recentLostFound: z.array(z.string()),
      }),
      toolResult: z
        .object({ name: z.string(), result: z.string() })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authenticated = await getAuthenticatedAgentContext(data.accessToken);
    if (!authenticated) {
      return {
        type: "final" as const,
        message: "Please sign in again before using the campus assistant.",
        args: {},
        requiresConfirmation: false,
      };
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        type: "final" as const,
        message: "The campus assistant is not configured yet. Please contact the system administrator.",
        args: {},
        requiresConfirmation: false,
      };
    }

    const prompt = `
You are Omni-Intelligence, a warm and practical USIU-Africa campus agent.
Return exactly one JSON object and no Markdown. The object must match this shape:
{"type":"final"|"tool_call","message":"string","tool":"optional string","args":{},"requiresConfirmation":false}

Available student tools:
- readAppointments: read the signed-in student's appointments. Args: {}
- countAppointments: count the signed-in student's appointments. Args: {}
- readCourses: list available courses. Args: {}
- countCourses: count available courses. Args: {}
- insertAppointment: book an appointment. Args: {"doctor_id":"string","date":"YYYY-MM-DD","time":"HH:MM","reason":"optional string"}

Available admin tools, only when the signed-in role permits them:
- Library (libadmin, superadmin): libraryAddBook, libraryUpdateBook, libraryDeleteBook, libraryReturnBook, libraryUpdateRequest, libraryAddResource, libraryDeleteResource.
- Clubs (clubadmin, superadmin): clubCreate, clubDelete, clubCreateEvent, clubDeleteEvent, clubAddResource, clubDeleteResource.
- Medical (medadmin, superadmin): medicalUpdateAppointment, medicalAddDoctor, medicalDeleteDoctor, medicalAddMedication, medicalDeleteMedication, medicalAddResource, medicalDeleteResource.
Admin tool args must contain the IDs and fields required by the matching dashboard action.

Rules:
1. Use a tool when the question needs account or catalog data.
2. Never invent doctor IDs, appointment times, or database results.
3. For insertAppointment, set requiresConfirmation to true and do not execute it until the student confirms.
4. Every admin tool call and every insert/update/delete action must set requiresConfirmation to true.
5. Never select a tool outside the signed-in role's permission set.
6. If required details are missing, return a final question instead of a tool call.
7. After a tool result is provided, return a concise, human-sounding final answer.
8. Do not request student IDs, passwords, or private UUIDs.

Signed-in role: ${authenticated.role}
Student profile: ${JSON.stringify(authenticated.userProfile ?? {})}
Campus context: ${JSON.stringify(data.context)}
Student request: ${data.userPrompt}
${data.toolResult ? `Tool result from ${data.toolResult.name}: ${data.toolResult.result}` : ""}
`;

    for (const config of MODELS) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel(
          { model: config.name },
          { apiVersion: config.version as "v1" | "v1beta" },
        );
        const result = await model.generateContent(prompt);
        return parseAgentStep(result.response.text());
      } catch (error) {
        console.warn(`[Gemini Agent] Model ${config.name} failed:`, error);
      }
    }

    return {
      type: "final" as const,
      message: "I couldn't complete that campus request right now. Please try again in a moment.",
      args: {},
      requiresConfirmation: false,
    };
  });

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
      1. Sound like a warm, knowledgeable human campus staff member, not a robot.
      2. Use simple, natural language and keep answers concise unless the student asks for detail.
      3. Use USIU-Africa and OmniCampus terminology naturally.
      4. Use the "Current Campus Context" above to answer questions accurately.
      5. If a student asks for something not in the context, say that plainly and suggest the relevant campus service.
      6. Do not use Markdown, asterisks, hashtags, code formatting, or formal section headings.
      7. NEVER ask for Student IDs or private UUIDs.
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
        return cleanAssistantResponse(result.response.text());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Gemini Fallback] Model ${config.name} failed:`, message);
        lastErrors.push(`${config.name}: ${message}`);
      }
    }

    console.error("[USIU Campus Agent] All models failed:", lastErrors[0]);
    return "Connection Error: I'm having trouble accessing USIU campus data right now. Please try again later.";
  });
