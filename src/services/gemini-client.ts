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

export const generateCampusResponse = async (
  userPrompt: string,
  conversationHistory?: CampusConversationTurn[],
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must be signed in to use the campus assistant.");
  }
  return generateCampusResponseServer({
    data: { userPrompt, conversationHistory, accessToken: session.access_token },
  });
};

export const runCampusAgentStep = async (
  userPrompt: string,
  toolResult?: { name: string; result: string },
  conversationHistory?: CampusConversationTurn[],
): Promise<CampusAgentStep> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must be signed in to use the campus agent.");
  }
  return runCampusAgentStepServer({
    data: { userPrompt, toolResult, accessToken: session.access_token, conversationHistory },
  });
};
