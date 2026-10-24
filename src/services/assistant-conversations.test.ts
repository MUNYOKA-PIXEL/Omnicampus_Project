import { describe, expect, it } from "vitest";
import { createConversationTitle, parseConversationMessages } from "./assistant-conversations";

describe("assistant conversation history", () => {
  it("uses the first user message as the conversation title", () => {
    expect(
      createConversationTitle([
        { id: 0, role: "assistant", text: "Welcome" },
        { id: 1, role: "user", text: "  How do I join a club?  " },
        { id: 2, role: "assistant", text: "Visit the clubs page." },
      ]),
    ).toBe("How do I join a club?");
  });

  it("limits conversation titles to 120 characters", () => {
    const title = createConversationTitle([{ id: 1, role: "user", text: "a".repeat(130) }]);
    expect(title).toHaveLength(120);
    expect(title.endsWith("...")).toBe(true);
  });

  it("rejects invalid saved messages instead of silently dropping them", () => {
    expect(() => parseConversationMessages([{ id: 1, role: "other", text: "invalid" }])).toThrow(
      "Saved conversation contains an invalid message.",
    );
  });
});
