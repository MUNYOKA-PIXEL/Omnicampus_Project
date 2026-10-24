import { describe, expect, it } from "vitest";
import { getRequestedContext } from "./campusContext";

describe("getRequestedContext", () => {
  it("does not request campus data for a general greeting", () => {
    expect(getRequestedContext("Hello, how are you?")).toEqual({
      books: false,
      events: false,
      doctors: false,
      lostFound: false,
      clubs: false,
      medications: false,
    });
  });

  it("requests only the datasets relevant to the user's question", () => {
    expect(getRequestedContext("Can I book an appointment with a doctor?")).toEqual({
      books: false,
      events: false,
      doctors: true,
      lostFound: false,
      clubs: false,
      medications: false,
    });
    expect(getRequestedContext("What clubs and events are coming up?")).toEqual({
      books: false,
      events: true,
      doctors: false,
      lostFound: false,
      clubs: true,
      medications: false,
    });
    expect(getRequestedContext("I lost my library book")).toEqual({
      books: true,
      events: false,
      doctors: false,
      lostFound: true,
      clubs: false,
      medications: false,
    });
  });

  it("requests multiple datasets when the question needs them", () => {
    expect(getRequestedContext("Find a book and tell me about upcoming events")).toEqual({
      books: true,
      events: true,
      doctors: false,
      lostFound: false,
      clubs: false,
      medications: false,
    });
  });

  it("loads the relevant context for follow-up self-service actions", () => {
    expect(getRequestedContext("Cancel my appointment and request a book")).toEqual({
      books: true,
      events: false,
      doctors: true,
      lostFound: false,
      clubs: false,
      medications: false,
    });
    expect(getRequestedContext("Join a club and RSVP to an event")).toEqual({
      books: false,
      events: true,
      doctors: false,
      lostFound: false,
      clubs: true,
      medications: false,
    });
    expect(getRequestedContext("Show available medicines from the pharmacy")).toEqual({
      books: false,
      events: false,
      doctors: false,
      lostFound: false,
      clubs: false,
      medications: true,
    });
  });
});
