import { describe, expect, it } from "vitest";
import { getRequestedContext } from "./campusContext";

describe("getRequestedContext", () => {
  it("does not request campus data for a general greeting", () => {
    expect(getRequestedContext("Hello, how are you?")).toEqual({
      books: false,
      events: false,
      doctors: false,
      lostFound: false,
    });
  });

  it("requests only the datasets relevant to the user's question", () => {
    expect(getRequestedContext("Can I book an appointment with a doctor?")).toEqual({
      books: false,
      events: false,
      doctors: true,
      lostFound: false,
    });
    expect(getRequestedContext("What clubs and events are coming up?")).toEqual({
      books: false,
      events: true,
      doctors: false,
      lostFound: false,
    });
    expect(getRequestedContext("I lost my library book")).toEqual({
      books: true,
      events: false,
      doctors: false,
      lostFound: true,
    });
  });

  it("requests multiple datasets when the question needs them", () => {
    expect(getRequestedContext("Find a book and tell me about upcoming events")).toEqual({
      books: true,
      events: true,
      doctors: false,
      lostFound: false,
    });
  });
});
