import { getCampusContext } from "./campusContext";
import { generateCampusResponse as generateCampusResponseServer } from "./gemini";

export const generateCampusResponse = async (
  userPrompt: string,
  userProfile?: { course?: string | null; year_of_study?: number | null },
) => {
  const context = await getCampusContext();
  return generateCampusResponseServer({
    data: { userPrompt, userProfile, context },
  });
};
