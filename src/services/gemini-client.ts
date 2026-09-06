import { getCampusContext } from "./campusContext";
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

export type CampusRole = "superadmin" | "student" | "libadmin" | "medadmin" | "clubadmin";

export const generateCampusResponse = async (
  userPrompt: string,
  userProfile?: { course?: string | null; year_of_study?: number | null },
) => {
  const context = await getCampusContext();
  return generateCampusResponseServer({
    data: { userPrompt, userProfile, context },
  });
};

export const runCampusAgentStep = async (
  userPrompt: string,
  userProfile?: { course?: string | null; year_of_study?: number | null },
  toolResult?: { name: string; result: string },
  role: CampusRole = "student",
): Promise<CampusAgentStep> => {
  const context = await getCampusContext();
  return runCampusAgentStepServer({
    data: { userPrompt, userProfile, context, toolResult, role },
  });
};
