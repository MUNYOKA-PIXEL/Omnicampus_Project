import { describe, expect, it } from "vitest";
import { ADMIN_TOOL_ROLES, getToolArgsValidationMessage, validateToolArgs } from "./tools";

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
