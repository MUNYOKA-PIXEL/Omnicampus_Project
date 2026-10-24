import { getCampusContext } from "./campusContext";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCampusResponse as generateCampusResponseServer,
  runCampusAgentStep as runCampusAgentStepServer,
} from "./gemini";

export type CampusAgentStep = {
  type: "final" | "tool_call";
  message: string;
  tool?: string;
  args: Record<string, string | number | boolean | null>;
  requiresConfirmation: boolean;
};

export type CampusConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

export type CampusRole = "superadmin" | "student" | "libadmin" | "medadmin" | "clubadmin";

export const generateCampusResponse = async (
  userPrompt: string,
  userProfile?: { course?: string | null; year_of_study?: number | null },
  conversationHistory?: CampusConversationTurn[],
) => {
  const context = await getCampusContext();
  return generateCampusResponseServer({
    data: { userPrompt, userProfile, context, conversationHistory },
  });
};

export const runCampusAgentStep = async (
  userPrompt: string,
  userProfile?: { course?: string | null; year_of_study?: number | null },
  toolResult?: { name: string; result: string },
  role: CampusRole = "student",
  conversationHistory?: CampusConversationTurn[],
): Promise<CampusAgentStep> => {
  const context = await getCampusContext();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must be signed in to use the campus agent.");
  }
  return runCampusAgentStepServer({
    data: { userPrompt, userProfile, context, toolResult, role, accessToken: session.access_token, conversationHistory },
  });
};
