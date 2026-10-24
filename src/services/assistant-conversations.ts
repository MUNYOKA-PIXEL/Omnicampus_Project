import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}

export type SavedConversation = Database["public"]["Tables"]["ai_conversations"]["Row"];

export const MAX_SAVED_CONVERSATIONS = 50;

export function createConversationTitle(messages: ConversationMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user")?.text.trim();
  if (!firstUserMessage) return "New conversation";
  return firstUserMessage.length > 120
    ? `${firstUserMessage.slice(0, 117).trimEnd()}...`
    : firstUserMessage;
}

export function parseConversationMessages(value: Json): ConversationMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Saved conversation has an invalid message list.");
  }

  return value.map((message) => {
    if (
      typeof message !== "object" ||
      message === null ||
      Array.isArray(message) ||
      typeof message.id !== "number" ||
      (message.role !== "assistant" && message.role !== "user") ||
      typeof message.text !== "string"
    ) {
      throw new Error("Saved conversation contains an invalid message.");
    }
    return { id: message.id, role: message.role, text: message.text };
  });
}

export async function listSavedConversations(userId: string): Promise<SavedConversation[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_SAVED_CONVERSATIONS);

  if (error) throw error;
  return data;
}

export async function saveConversation(
  userId: string,
  conversationId: string | null,
  messages: ConversationMessage[],
): Promise<SavedConversation> {
  const title = createConversationTitle(messages);
  const serializedMessages: Json = messages.map(({ id, role, text }) => ({ id, role, text }));
  const payload = { user_id: userId, title, messages: serializedMessages };
  const query = conversationId
    ? supabase
        .from("ai_conversations")
        .update(payload)
        .eq("id", conversationId)
        .eq("user_id", userId)
    : supabase.from("ai_conversations").insert(payload);
  const { data, error } = await query.select("*").single();

  if (error) throw error;
  return data;
}

export async function deleteSavedConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}
