// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getCampusDate } from "./campusContext";

/**
 * Counts the number of appointments for a specific user.
 */
export const countAppointments = async (userId: string) => {
  try {
    const { count, error } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) throw error;

    // Audit log
    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      action: "AI_COUNT_APPOINTMENTS",
      details: { count: count || 0 },
    });

    return `You have ${count || 0} appointments scheduled.`;
  } catch (error) {
    console.error("Error counting appointments:", error);
    return "I couldn't retrieve your appointment count right now.";
  }
};

/**
 * Reads upcoming appointments for a specific user.
 */
export const readAppointments = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, doctors(name)")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) throw error;

    // Audit log
    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      action: "AI_READ_APPOINTMENTS",
      details: { appointment_count: data?.length || 0 },
    });

    if (!data || data.length === 0) return "You have no upcoming appointments.";

    const list = data
      .map(
        (a) =>
          `- ${a.date} at ${a.time} with Dr. ${a.doctors?.name || "Unknown"} (Reason: ${a.reason || "None"})`,
      )
      .join("\n");
    return `Here are your upcoming appointments:\n${list}`;
  } catch (error) {
    console.error("Error reading appointments:", error);
    return "I'm having trouble reading your appointments list.";
  }
};

/**
 * Books a new appointment for a student.
 */
export const insertAppointment = async (
  userId: string,
  args: { doctor_id: string; date: string; time: string; reason?: string },
  appointmentUserId = userId,
) => {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .insert([{ ...args, user_id: appointmentUserId }])
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No data returned after insert");

    // Audit log for security
    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      action: "AI_BOOK_APPOINTMENT",
      details: { ...args, appointment_id: data[0].id, booked_for: appointmentUserId },
    });

    return `Appointment request submitted for ${args.date} at ${args.time}. It is pending medical admin confirmation. Reference ID: ${data[0].id}`;
  } catch (error) {
    console.error("Error inserting appointment:", error);
    return error instanceof Error
      ? `The appointment was not booked: ${error.message}`
      : "The appointment was not booked. Check the practitioner, date, and time, then try again.";
  }
};

/**
 * Counts total available courses in the USIU catalog.
 */
export const countCourses = async (userId?: string) => {
  try {
    const { count, error } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    // Audit log
    await supabase.from("ai_audit_logs").insert({
      user_id: userId || null,
      action: "AI_COUNT_COURSES",
      details: { count: count || 0 },
    });

    return `There are currently ${count || 0} courses available in the USIU catalog.`;
  } catch (error) {
    console.error("Error counting courses:", error);
    return "I couldn't fetch the course count from the database.";
  }
};

/**
 * Lists available courses.
 */
export const readCourses = async (userId?: string) => {
  try {
    const { data, error } = await supabase.from("courses").select("*").limit(10);

    if (error) throw error;

    // Audit log
    await supabase.from("ai_audit_logs").insert({
      user_id: userId || null,
      action: "AI_READ_COURSES",
      details: { course_count: data?.length || 0 },
    });

    if (!data || data.length === 0) return "No courses are currently listed in the system.";

    const list = data.map((c) => `- ${c.name} (${c.department}) - ${c.credits} Credits`).join("\n");
    return `Here are some available courses:\n${list}`;
  } catch (error) {
    console.error("Error reading courses:", error);
    return "I'm having trouble listing the courses right now.";
  }
};

const runAdminMutation = async (
  userId: string,
  table: string,
  operation: string,
  args: Record<string, any>,
) => {
  try {
    let result: any;
    if (operation === "insert")
      result = await supabase
        .from(table)
        .insert({ ...args, ...(table === "resources" ? { uploaded_by: userId } : {}) });
    if (operation === "update")
      result = await supabase.from(table).update(args.values).eq("id", args.id);
    if (operation === "delete") result = await supabase.from(table).delete().eq("id", args.id);
    if (result?.error) throw result.error;
    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      action: `AI_ADMIN_${operation.toUpperCase()}_${table.toUpperCase()}`,
      details: args,
    });
    return `Completed ${operation} on ${table} successfully.`;
  } catch (error) {
    console.error(`Admin AI ${operation} failed for ${table}:`, error);
    return `I couldn't complete that ${operation} on ${table}. Please check the details and your admin permissions.`;
  }
};

const returnBook = async (userId: string, args: Record<string, any>) => {
  const { error } = await supabase.rpc("return_book", { loan_id_input: args.loan_id });
  if (error) return "I couldn't mark that book as returned. Please check the loan ID.";
  await supabase
    .from("ai_audit_logs")
    .insert({ user_id: userId, action: "AI_ADMIN_RETURN_BOOK", details: args });
  return "The book was marked as returned and the inventory was updated.";
};

const borrowBook = async (userId: string, args: { book_id: string }) => {
  const { data, error } = await supabase.rpc("borrow_book", { book_id_input: args.book_id });
  if (error) {
    console.error("AI book borrowing failed:", error);
    return `The book was not borrowed: ${error.message}`;
  }
  if (!data) {
    console.error("AI book borrowing returned no loan record.");
    return "The book was not borrowed because no loan record was returned.";
  }

  const { error: auditError } = await supabase.from("ai_audit_logs").insert({
    user_id: userId,
    action: "AI_BORROW_BOOK",
    details: { book_id: args.book_id, loan_id: data.id },
  });
  if (auditError) {
    console.error("Failed to write AI book-borrowing audit log:", auditError);
  }

  return `The book was borrowed successfully. It is due on ${data.due_date}. Loan reference: ${data.id}.`;
};

const readLibraryAccount = async (userId: string) => {
  const [loans, requests] = await Promise.all([
    supabase
      .from("book_loans")
      .select("id, due_date, status, books(title)")
      .eq("user_id", userId)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("book_requests")
      .select("title, author, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (loans.error || requests.error) {
    console.error("Failed to read student library account:", loans.error ?? requests.error);
    return "I couldn't retrieve your library loans or requests right now.";
  }

  return JSON.stringify({
    loans: (loans.data ?? []).map((loan) => ({
      title: loan.books?.title ?? "Unknown book",
      due_date: loan.due_date,
      status: loan.status,
    })),
    book_requests: requests.data ?? [],
  });
};

const requestBook = async (
  userId: string,
  args: { title: string; author?: string; reason?: string },
) => {
  const { error } = await supabase.from("book_requests").insert({
    user_id: userId,
    title: args.title,
    author: args.author || null,
    reason: args.reason || null,
  });
  if (error) {
    console.error("AI book request failed:", error);
    return `The book request was not submitted: ${error.message}`;
  }
  return `Your request for "${args.title}" was submitted to the library team.`;
};

const cancelAppointment = async (userId: string, args: { appointment_id: string }) => {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", args.appointment_id)
    .eq("user_id", userId)
    .in("status", ["pending", "confirmed"])
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("AI appointment cancellation failed:", error);
    return `The appointment was not cancelled: ${error.message}`;
  }
  if (!data)
    return "The appointment was not cancelled because it was not found or is not cancellable.";
  return "Your appointment was cancelled.";
};

const updateClubMembership = async (
  userId: string,
  args: { club_id: string; action: "join" | "leave" },
) => {
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", args.club_id)
    .maybeSingle();
  if (clubError || !club) {
    if (clubError) console.error("Failed to validate club membership action:", clubError);
    return "I couldn't find that club. Please check the club list and try again.";
  }

  const result =
    args.action === "join"
      ? await supabase.from("club_memberships").insert({ club_id: args.club_id, user_id: userId })
      : await supabase
          .from("club_memberships")
          .delete()
          .eq("club_id", args.club_id)
          .eq("user_id", userId);
  if (result.error) {
    console.error(`AI could not ${args.action} club:`, result.error);
    return `I couldn't ${args.action} ${club.name}: ${result.error.message}`;
  }
  return args.action === "join" ? `You joined ${club.name}.` : `You left ${club.name}.`;
};

const updateEventRsvp = async (
  userId: string,
  args: { event_id: string; action: "attend" | "cancel" },
) => {
  const { data: event, error: eventError } = await supabase
    .from("club_events")
    .select("title, date")
    .eq("id", args.event_id)
    .gte("date", getCampusDate())
    .maybeSingle();
  if (eventError || !event) {
    if (eventError) console.error("Failed to validate event RSVP action:", eventError);
    return "I couldn't find that upcoming event. Please check the events list and try again.";
  }

  const result =
    args.action === "attend"
      ? await supabase.from("event_rsvps").insert({ event_id: args.event_id, user_id: userId })
      : await supabase
          .from("event_rsvps")
          .delete()
          .eq("event_id", args.event_id)
          .eq("user_id", userId);
  if (result.error) {
    console.error(`AI could not update event RSVP:`, result.error);
    return `I couldn't ${args.action === "attend" ? "RSVP to" : "cancel your RSVP for"} ${event.title}: ${result.error.message}`;
  }
  return args.action === "attend"
    ? `Your RSVP for ${event.title} was confirmed.`
    : `Your RSVP for ${event.title} was cancelled.`;
};

const createLostFoundReport = async (
  userId: string,
  args: {
    type: "lost" | "found";
    item_name: string;
    description?: string;
    location?: string;
    date_reported: string;
  },
) => {
  const { error } = await supabase.from("lost_found_items").insert({
    user_id: userId,
    type: args.type,
    item_name: args.item_name,
    description: args.description || null,
    location: args.location || null,
    date_reported: args.date_reported,
    status: "open",
  });
  if (error) {
    console.error("AI lost-and-found report failed:", error);
    return `Your ${args.type} item report was not submitted: ${error.message}`;
  }
  return `Your ${args.type} item report for "${args.item_name}" was submitted. You can add a photo from the Lost & Found page.`;
};

const resolveLostFoundReport = async (userId: string, args: { report_id: string }) => {
  const { data, error } = await supabase
    .from("lost_found_items")
    .update({ status: "resolved" })
    .eq("id", args.report_id)
    .eq("user_id", userId)
    .eq("status", "open")
    .select("item_name, type")
    .maybeSingle();
  if (error) {
    console.error("AI lost-and-found resolution failed:", error);
    return `Your report was not updated: ${error.message}`;
  }
  if (!data) return "Your report was not updated because it was not found or is already resolved.";
  return data.type === "found"
    ? `Your report for "${data.item_name}" was marked as claimed.`
    : `Your report for "${data.item_name}" was marked as found.`;
};

export const STUDENT_MUTATION_TOOLS = [
  "insertAppointment",
  "cancelAppointment",
  "libraryBorrowBook",
  "libraryRequestBook",
  "clubMembership",
  "eventRsvp",
  "createLostFoundReport",
  "resolveLostFoundReport",
] as const;

export const ADMIN_TOOL_ROLES: Record<string, string[]> = {
  libraryAddBook: ["libadmin", "superadmin"],
  libraryUpdateBook: ["libadmin", "superadmin"],
  libraryDeleteBook: ["libadmin", "superadmin"],
  libraryReturnBook: ["libadmin", "superadmin"],
  libraryUpdateRequest: ["libadmin", "superadmin"],
  libraryAddResource: ["libadmin", "superadmin"],
  libraryDeleteResource: ["libadmin", "superadmin"],
  clubCreate: ["clubadmin", "superadmin"],
  clubDelete: ["clubadmin", "superadmin"],
  clubCreateEvent: ["clubadmin", "superadmin"],
  clubDeleteEvent: ["clubadmin", "superadmin"],
  clubAddResource: ["clubadmin", "superadmin"],
  clubDeleteResource: ["clubadmin", "superadmin"],
  medicalUpdateAppointment: ["medadmin", "superadmin"],
  medicalAddDoctor: ["medadmin", "superadmin"],
  medicalDeleteDoctor: ["medadmin", "superadmin"],
  medicalAddMedication: ["medadmin", "superadmin"],
  medicalDeleteMedication: ["medadmin", "superadmin"],
  medicalAddResource: ["medadmin", "superadmin"],
  medicalDeleteResource: ["medadmin", "superadmin"],
};

const idArgs = z.object({ id: z.string().uuid() }).strict();
const toolArgumentSchemas: Record<string, z.ZodTypeAny> = {
  countAppointments: z.object({}).strict(),
  readAppointments: z.object({}).strict(),
  countCourses: z.object({}).strict(),
  readCourses: z.object({}).strict(),
  insertAppointment: z
    .object({
      doctor_id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      reason: z.string().max(500).optional(),
    })
    .strict(),
  readLibraryAccount: z.object({}).strict(),
  libraryBorrowBook: z.object({ book_id: z.string().uuid() }).strict(),
  libraryRequestBook: z
    .object({
      title: z.string().trim().min(1).max(200),
      author: z.string().trim().max(200).optional(),
      reason: z.string().trim().max(500).optional(),
    })
    .strict(),
  cancelAppointment: z.object({ appointment_id: z.string().uuid() }).strict(),
  clubMembership: z
    .object({ club_id: z.string().uuid(), action: z.enum(["join", "leave"]) })
    .strict(),
  eventRsvp: z
    .object({ event_id: z.string().uuid(), action: z.enum(["attend", "cancel"]) })
    .strict(),
  createLostFoundReport: z
    .object({
      type: z.enum(["lost", "found"]),
      item_name: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).optional(),
      location: z.string().trim().max(300).optional(),
      date_reported: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict(),
  resolveLostFoundReport: z.object({ report_id: z.string().uuid() }).strict(),
  libraryAddBook: z
    .object({
      title: z.string().min(1).max(200),
      author: z.string().min(1).max(200),
      category: z.string().min(1).max(100),
      copies: z.coerce.number().int().min(0).max(10000),
    })
    .strict(),
  libraryUpdateBook: idArgs
    .extend({
      title: z.string().min(1).max(200),
      author: z.string().min(1).max(200),
      category: z.string().min(1).max(100),
      copies: z.coerce.number().int().min(0).max(10000),
    })
    .strict(),
  libraryDeleteBook: idArgs,
  libraryReturnBook: z.object({ loan_id: z.string().uuid() }).strict(),
  libraryUpdateRequest: idArgs.extend({ status: z.enum(["approved", "rejected"]) }).strict(),
  libraryAddResource: z
    .object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() })
    .strict(),
  libraryDeleteResource: idArgs,
  clubCreate: z
    .object({
      name: z.string().min(1).max(200),
      description: z.string().max(2000),
      dues: z.string().max(100),
      meeting_day: z.string().max(100),
    })
    .strict(),
  clubDelete: idArgs,
  clubCreateEvent: z
    .object({
      club_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().max(2000),
      date: z.string(),
      time: z.string(),
      location: z.string().max(200),
    })
    .strict(),
  clubDeleteEvent: idArgs,
  clubAddResource: z
    .object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() })
    .strict(),
  clubDeleteResource: idArgs,
  medicalUpdateAppointment: idArgs
    .extend({ status: z.enum(["confirmed", "cancelled", "completed"]) })
    .strict(),
  medicalAddDoctor: z
    .object({ name: z.string().min(1).max(200), specialty: z.string().min(1).max(200) })
    .strict(),
  medicalDeleteDoctor: idArgs,
  medicalAddMedication: z
    .object({
      name: z.string().min(1).max(200),
      type: z.string().min(1).max(100),
      price: z.string().min(1).max(100),
    })
    .strict(),
  medicalDeleteMedication: idArgs,
  medicalAddResource: z
    .object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() })
    .strict(),
  medicalDeleteResource: idArgs,
};

export const validateToolArgs = (tool: string, args: Record<string, any>) => {
  const schema = toolArgumentSchemas[tool];
  if (!schema) return null;
  const result = schema.safeParse(args);
  return result.success ? (result.data as Record<string, any>) : null;
};

export const getToolArgsValidationMessage = (tool: string, args: Record<string, any>) => {
  const schema = toolArgumentSchemas[tool];
  if (!schema) return "This action is not available.";
  const result = schema.safeParse(args);
  if (result.success) return null;

  const labels: Record<string, string> = {
    doctor_id: "choose an available practitioner",
    date: "provide a valid date",
    time: "provide a valid time",
    reason: "shorten the reason",
    book_id: "choose a book from the available library list",
    appointment_id: "choose one of your active appointments",
    club_id: "choose a club from the club registry",
    event_id: "choose an upcoming event",
    report_id: "choose one of your open lost-and-found reports",
    item_name: "provide an item name",
    type: "specify whether the item is lost or found",
    date_reported: "provide a valid report date",
    title: "provide the requested book title",
  };
  const missingDetails = [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = String(issue.path[0] ?? "");
        return labels[field] ?? `check ${field || "the requested details"}`;
      }),
    ),
  ];
  return `Please ${missingDetails.join(", ")}.`;
};

// Map of tool names to their implementation functions
export const toolRegistry: Record<
  string,
  (userId: string, args: Record<string, any>, appointmentUserId?: string) => Promise<string>
> = {
  countAppointments: (userId: string) => countAppointments(userId),
  readAppointments: (userId: string) => readAppointments(userId),
  insertAppointment: (userId: string, args: any, appointmentUserId?: string) =>
    insertAppointment(userId, args, appointmentUserId),
  readLibraryAccount: (userId: string) => readLibraryAccount(userId),
  libraryBorrowBook: (userId, args) => borrowBook(userId, args),
  libraryRequestBook: (userId, args) => requestBook(userId, args),
  cancelAppointment: (userId, args) => cancelAppointment(userId, args),
  clubMembership: (userId, args) => updateClubMembership(userId, args),
  eventRsvp: (userId, args) => updateEventRsvp(userId, args),
  createLostFoundReport: (userId, args) => createLostFoundReport(userId, args),
  resolveLostFoundReport: (userId, args) => resolveLostFoundReport(userId, args),
  countCourses: (userId: string) => countCourses(userId),
  readCourses: (userId: string) => readCourses(userId),
  libraryAddBook: (userId, args) =>
    runAdminMutation(userId, "books", "insert", { ...args, available: Number(args.copies) > 0 }),
  libraryUpdateBook: (userId, args) =>
    runAdminMutation(userId, "books", "update", {
      id: args.id,
      values: {
        title: args.title,
        author: args.author,
        category: args.category,
        copies: Number(args.copies),
        available: Number(args.copies) > 0,
      },
    }),
  libraryDeleteBook: (userId, args) => runAdminMutation(userId, "books", "delete", args),
  libraryReturnBook: returnBook,
  libraryUpdateRequest: (userId, args) =>
    runAdminMutation(userId, "book_requests", "update", {
      id: args.id,
      values: { status: args.status },
    }),
  libraryAddResource: (userId, args) => runAdminMutation(userId, "resources", "insert", args),
  libraryDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
  clubCreate: (userId, args) =>
    runAdminMutation(userId, "clubs", "insert", { ...args, created_by: userId }),
  clubDelete: (userId, args) => runAdminMutation(userId, "clubs", "delete", args),
  clubCreateEvent: (userId, args) => runAdminMutation(userId, "club_events", "insert", args),
  clubDeleteEvent: (userId, args) => runAdminMutation(userId, "club_events", "delete", args),
  clubAddResource: (userId, args) => runAdminMutation(userId, "resources", "insert", args),
  clubDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
  medicalUpdateAppointment: (userId, args) =>
    runAdminMutation(userId, "appointments", "update", {
      id: args.id,
      values: { status: args.status },
    }),
  medicalAddDoctor: (userId, args) =>
    runAdminMutation(userId, "doctors", "insert", { ...args, available: true }),
  medicalDeleteDoctor: (userId, args) => runAdminMutation(userId, "doctors", "delete", args),
  medicalAddMedication: (userId, args) =>
    runAdminMutation(userId, "medications", "insert", { ...args, available: true }),
  medicalDeleteMedication: (userId, args) =>
    runAdminMutation(userId, "medications", "delete", args),
  medicalAddResource: (userId, args) =>
    runAdminMutation(userId, "resources", "insert", { ...args, category: "wellness" }),
  medicalDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
};
