// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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
      details: { count: count || 0 }
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
      details: { appointment_count: data?.length || 0 }
    });

    if (!data || data.length === 0) return "You have no upcoming appointments.";
    
    const list = data.map(a => `- ${a.date} at ${a.time} with Dr. ${a.doctors?.name || 'Unknown'} (Reason: ${a.reason || 'None'})`).join("\n");
    return `Here are your upcoming appointments:\n${list}`;
  } catch (error) {
    console.error("Error reading appointments:", error);
    return "I'm having trouble reading your appointments list.";
  }
};

/**
 * Books a new appointment for a student.
 */
export const insertAppointment = async (userId: string, args: { doctor_id: string; date: string; time: string; reason?: string }) => {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .insert([{ ...args, user_id: userId }])
      .select();
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No data returned after insert");
    
    // Audit log for security
    await supabase.from("ai_audit_logs").insert({
      user_id: userId,
      action: "AI_BOOK_APPOINTMENT",
      details: { ...args, appointment_id: data[0].id }
    });
    
    return `Successfully booked your appointment for ${args.date} at ${args.time}. Reference ID: ${data[0].id}`;
  } catch (error) {
    console.error("Error inserting appointment:", error);
    return "I failed to book that appointment. Please ensure the Date (YYYY-MM-DD) and Time are valid, or try again later.";
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
      details: { count: count || 0 }
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
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .limit(10);
    
    if (error) throw error;

    // Audit log
    await supabase.from("ai_audit_logs").insert({
      user_id: userId || null,
      action: "AI_READ_COURSES",
      details: { course_count: data?.length || 0 }
    });

    if (!data || data.length === 0) return "No courses are currently listed in the system.";
    
    const list = data.map(c => `- ${c.name} (${c.department}) - ${c.credits} Credits`).join("\n");
    return `Here are some available courses:\n${list}`;
  } catch (error) {
    console.error("Error reading courses:", error);
    return "I'm having trouble listing the courses right now.";
  }
};

const runAdminMutation = async (userId: string, table: string, operation: string, args: Record<string, any>) => {
  try {
    let result: any;
    if (operation === "insert") result = await supabase.from(table).insert({ ...args, ...(table === "resources" ? { uploaded_by: userId } : {}) });
    if (operation === "update") result = await supabase.from(table).update(args.values).eq("id", args.id);
    if (operation === "delete") result = await supabase.from(table).delete().eq("id", args.id);
    if (result?.error) throw result.error;
    await supabase.from("ai_audit_logs").insert({ user_id: userId, action: `AI_ADMIN_${operation.toUpperCase()}_${table.toUpperCase()}`, details: args });
    return `Completed ${operation} on ${table} successfully.`;
  } catch (error) {
    console.error(`Admin AI ${operation} failed for ${table}:`, error);
    return `I couldn't complete that ${operation} on ${table}. Please check the details and your admin permissions.`;
  }
};

const returnBook = async (userId: string, args: Record<string, any>) => {
  const { error } = await supabase.rpc("return_book", { loan_id_input: args.loan_id });
  if (error) return "I couldn't mark that book as returned. Please check the loan ID.";
  await supabase.from("ai_audit_logs").insert({ user_id: userId, action: "AI_ADMIN_RETURN_BOOK", details: args });
  return "The book was marked as returned and the inventory was updated.";
};

export const ADMIN_TOOL_ROLES: Record<string, string[]> = {
  libraryAddBook: ["libadmin", "superadmin"], libraryUpdateBook: ["libadmin", "superadmin"],
  libraryDeleteBook: ["libadmin", "superadmin"], libraryReturnBook: ["libadmin", "superadmin"],
  libraryUpdateRequest: ["libadmin", "superadmin"], libraryAddResource: ["libadmin", "superadmin"],
  libraryDeleteResource: ["libadmin", "superadmin"], clubCreate: ["clubadmin", "superadmin"],
  clubDelete: ["clubadmin", "superadmin"], clubCreateEvent: ["clubadmin", "superadmin"],
  clubDeleteEvent: ["clubadmin", "superadmin"], clubAddResource: ["clubadmin", "superadmin"],
  clubDeleteResource: ["clubadmin", "superadmin"], medicalUpdateAppointment: ["medadmin", "superadmin"],
  medicalAddDoctor: ["medadmin", "superadmin"], medicalDeleteDoctor: ["medadmin", "superadmin"],
  medicalAddMedication: ["medadmin", "superadmin"], medicalDeleteMedication: ["medadmin", "superadmin"],
  medicalAddResource: ["medadmin", "superadmin"], medicalDeleteResource: ["medadmin", "superadmin"],
};

const idArgs = z.object({ id: z.string().uuid() }).strict();
const toolArgumentSchemas: Record<string, z.ZodTypeAny> = {
  countAppointments: z.object({}).strict(),
  readAppointments: z.object({}).strict(),
  countCourses: z.object({}).strict(),
  readCourses: z.object({}).strict(),
  insertAppointment: z.object({
    doctor_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string().max(500).optional(),
  }).strict(),
  libraryAddBook: z.object({ title: z.string().min(1).max(200), author: z.string().min(1).max(200), category: z.string().min(1).max(100), copies: z.coerce.number().int().min(0).max(10000) }).strict(),
  libraryUpdateBook: idArgs.extend({ title: z.string().min(1).max(200), author: z.string().min(1).max(200), category: z.string().min(1).max(100), copies: z.coerce.number().int().min(0).max(10000) }).strict(),
  libraryDeleteBook: idArgs,
  libraryReturnBook: z.object({ loan_id: z.string().uuid() }).strict(),
  libraryUpdateRequest: idArgs.extend({ status: z.enum(["approved", "rejected"]) }).strict(),
  libraryAddResource: z.object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() }).strict(),
  libraryDeleteResource: idArgs,
  clubCreate: z.object({ name: z.string().min(1).max(200), description: z.string().max(2000), dues: z.string().max(100), meeting_day: z.string().max(100) }).strict(),
  clubDelete: idArgs,
  clubCreateEvent: z.object({ club_id: z.string().uuid(), title: z.string().min(1).max(200), description: z.string().max(2000), date: z.string(), time: z.string(), location: z.string().max(200) }).strict(),
  clubDeleteEvent: idArgs,
  clubAddResource: z.object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() }).strict(),
  clubDeleteResource: idArgs,
  medicalUpdateAppointment: idArgs.extend({ status: z.enum(["confirmed", "cancelled", "completed"]) }).strict(),
  medicalAddDoctor: z.object({ name: z.string().min(1).max(200), specialty: z.string().min(1).max(200) }).strict(),
  medicalDeleteDoctor: idArgs,
  medicalAddMedication: z.object({ name: z.string().min(1).max(200), type: z.string().min(1).max(100), price: z.string().min(1).max(100) }).strict(),
  medicalDeleteMedication: idArgs,
  medicalAddResource: z.object({ title: z.string().min(1).max(200), file_url: z.string().url().nullable().optional() }).strict(),
  medicalDeleteResource: idArgs,
};

export const validateToolArgs = (tool: string, args: Record<string, any>) => {
  const schema = toolArgumentSchemas[tool];
  if (!schema) return null;
  const result = schema.safeParse(args);
  return result.success ? (result.data as Record<string, any>) : null;
};

// Map of tool names to their implementation functions
export const toolRegistry: Record<string, (userId: string, args: Record<string, any>) => Promise<string>> = {
  countAppointments: (userId: string) => countAppointments(userId),
  readAppointments: (userId: string) => readAppointments(userId),
  insertAppointment: (userId: string, args: any) => insertAppointment(userId, args),
  countCourses: (userId: string) => countCourses(userId),
  readCourses: (userId: string) => readCourses(userId),
  libraryAddBook: (userId, args) => runAdminMutation(userId, "books", "insert", { ...args, available: Number(args.copies) > 0 }),
  libraryUpdateBook: (userId, args) => runAdminMutation(userId, "books", "update", { id: args.id, values: { title: args.title, author: args.author, category: args.category, copies: Number(args.copies), available: Number(args.copies) > 0 } }),
  libraryDeleteBook: (userId, args) => runAdminMutation(userId, "books", "delete", args),
  libraryReturnBook: returnBook,
  libraryUpdateRequest: (userId, args) => runAdminMutation(userId, "book_requests", "update", { id: args.id, values: { status: args.status } }),
  libraryAddResource: (userId, args) => runAdminMutation(userId, "resources", "insert", args),
  libraryDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
  clubCreate: (userId, args) => runAdminMutation(userId, "clubs", "insert", { ...args, created_by: userId }),
  clubDelete: (userId, args) => runAdminMutation(userId, "clubs", "delete", args),
  clubCreateEvent: (userId, args) => runAdminMutation(userId, "club_events", "insert", args),
  clubDeleteEvent: (userId, args) => runAdminMutation(userId, "club_events", "delete", args),
  clubAddResource: (userId, args) => runAdminMutation(userId, "resources", "insert", args),
  clubDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
  medicalUpdateAppointment: (userId, args) => runAdminMutation(userId, "appointments", "update", { id: args.id, values: { status: args.status } }),
  medicalAddDoctor: (userId, args) => runAdminMutation(userId, "doctors", "insert", { ...args, available: true }),
  medicalDeleteDoctor: (userId, args) => runAdminMutation(userId, "doctors", "delete", args),
  medicalAddMedication: (userId, args) => runAdminMutation(userId, "medications", "insert", { ...args, available: true }),
  medicalDeleteMedication: (userId, args) => runAdminMutation(userId, "medications", "delete", args),
  medicalAddResource: (userId, args) => runAdminMutation(userId, "resources", "insert", { ...args, category: "wellness" }),
  medicalDeleteResource: (userId, args) => runAdminMutation(userId, "resources", "delete", args),
};
