import { describe, expect, it } from "vitest";
import {
  ADMIN_TOOL_ROLES,
  STUDENT_MUTATION_TOOLS,
  getToolArgsValidationMessage,
  validateToolArgs,
} from "./tools";

describe("appointment assistant tool validation", () => {
  const validAppointment = {
    doctor_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
    date: "2026-11-01",
    time: "10:30",
    reason: "Routine checkup",
  };

  it("accepts valid appointment details", () => {
    expect(validateToolArgs("insertAppointment", validAppointment)).toEqual(validAppointment);
  });

  it("rejects a patient ID in model-supplied arguments", () => {
    expect(
      validateToolArgs("insertAppointment", {
        ...validAppointment,
        user_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
      }),
    ).toBeNull();
  });

  it("rejects malformed practitioner IDs, dates, and times", () => {
    expect(
      validateToolArgs("insertAppointment", { ...validAppointment, doctor_id: "unknown" }),
    ).toBeNull();
    expect(
      validateToolArgs("insertAppointment", { ...validAppointment, date: "tomorrow" }),
    ).toBeNull();
    expect(validateToolArgs("insertAppointment", { ...validAppointment, time: "10am" })).toBeNull();
  });

  it("returns a user-facing validation hint for missing appointment details", () => {
    expect(
      getToolArgsValidationMessage("insertAppointment", {
        date: "2026-11-01",
        time: "10:30",
      }),
    ).toContain("choose an available practitioner");
  });
});

describe("admin assistant tool permissions", () => {
  it("limits medical appointment administration to medical admins and superadmins", () => {
    expect(ADMIN_TOOL_ROLES.medicalUpdateAppointment).toEqual(["medadmin", "superadmin"]);
    expect(ADMIN_TOOL_ROLES.medicalUpdateAppointment).not.toContain("student");
    expect(ADMIN_TOOL_ROLES.medicalUpdateAppointment).not.toContain("libadmin");
    expect(ADMIN_TOOL_ROLES.medicalUpdateAppointment).not.toContain("clubadmin");
  });
});

describe("student book-borrowing tool validation", () => {
  it("accepts a catalog book UUID and rejects malformed or additional arguments", () => {
    expect(
      validateToolArgs("libraryBorrowBook", {
        book_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
      }),
    ).toEqual({ book_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633" });
    expect(validateToolArgs("libraryBorrowBook", { book_id: "not-a-uuid" })).toBeNull();
    expect(
      validateToolArgs("libraryBorrowBook", {
        book_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
        user_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
      }),
    ).toBeNull();
  });

  it("makes book borrowing a self-service action rather than an admin-only tool", () => {
    expect(ADMIN_TOOL_ROLES.libraryBorrowBook).toBeUndefined();
  });
});

describe("student self-service action validation", () => {
  it("requires confirmation for every supported student-side change", () => {
    expect(STUDENT_MUTATION_TOOLS).toEqual(
      expect.arrayContaining([
        "insertAppointment",
        "cancelAppointment",
        "libraryBorrowBook",
        "libraryRequestBook",
        "clubMembership",
        "eventRsvp",
        "createLostFoundReport",
        "resolveLostFoundReport",
      ]),
    );
  });

  it("validates account-scoped appointment cancellation IDs", () => {
    expect(
      validateToolArgs("cancelAppointment", {
        appointment_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633",
      }),
    ).toEqual({ appointment_id: "a84eebc2-98f2-4a02-b25f-7ed85a440633" });
    expect(validateToolArgs("cancelAppointment", { appointment_id: "not-a-uuid" })).toBeNull();
  });

  it("validates library requests and excludes user IDs", () => {
    expect(validateToolArgs("libraryRequestBook", { title: "A campus textbook" })).toEqual({
      title: "A campus textbook",
    });
    expect(
      validateToolArgs("libraryRequestBook", { title: "A campus textbook", user_id: "other" }),
    ).toBeNull();
  });

  it("validates club, RSVP, and lost-and-found action arguments", () => {
    const id = "a84eebc2-98f2-4a02-b25f-7ed85a440633";
    expect(validateToolArgs("clubMembership", { club_id: id, action: "join" })).not.toBeNull();
    expect(validateToolArgs("eventRsvp", { event_id: id, action: "cancel" })).not.toBeNull();
    expect(
      validateToolArgs("createLostFoundReport", {
        type: "lost",
        item_name: "Student card",
        date_reported: "2026-10-24",
      }),
    ).not.toBeNull();
    expect(validateToolArgs("resolveLostFoundReport", { report_id: id })).not.toBeNull();
    expect(validateToolArgs("clubMembership", { club_id: id, action: "delete" })).toBeNull();
    expect(
      validateToolArgs("createLostFoundReport", {
        type: "other",
        item_name: "Student card",
        date_reported: "2026-10-24",
      }),
    ).toBeNull();
  });
});
