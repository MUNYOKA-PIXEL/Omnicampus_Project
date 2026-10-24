import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface CampusContext {
  availableBooks: string[];
  upcomingEvents: string[];
  medicalAvailability: string[];
  availableDoctors: { id: string; name: string; specialty: string }[];
  recentLostFound: string[];
}

export const getCampusDate = () => {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parts = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getCampusContext = async (
  supabase: SupabaseClient<Database>,
): Promise<CampusContext> => {
  const [books, events, doctors, lostItems] = await Promise.all([
    supabase.from("books").select("title, author").eq("available", true).limit(5),
    supabase
      .from("club_events")
      .select("title, date")
      .gte("date", getCampusDate())
      .order("date", { ascending: true })
      .limit(5),
    supabase
      .from("doctors")
      .select("id, name, specialty")
      .eq("available", true)
      .order("name")
      .limit(20),
    supabase
      .from("lost_found_items")
      .select("item_name, type, status")
      .order("date_reported", { ascending: false })
      .limit(5),
  ]);

  const failedQuery = [
    ["available books", books.error],
    ["upcoming events", events.error],
    ["available doctors", doctors.error],
    ["lost and found reports", lostItems.error],
  ].find(([, error]) => error);
  if (failedQuery) {
    const [resource, error] = failedQuery;
    console.error(`Error fetching campus ${resource}:`, error);
    throw new Error(`Unable to fetch campus ${resource}.`);
  }
  if (!books.data || !events.data || !doctors.data || !lostItems.data) {
    console.error("Campus context query completed without returning all result sets.");
    throw new Error("Unable to load complete campus information.");
  }

  return {
    availableBooks: books.data.map((book) => `${book.title} by ${book.author}`),
    upcomingEvents: events.data.map((event) => `${event.title} on ${event.date}`),
    medicalAvailability: doctors.data.map((doctor) => `${doctor.name} (${doctor.specialty})`),
    availableDoctors: doctors.data,
    recentLostFound: lostItems.data.map(
      (item) => `${item.item_name} (${item.type}) - ${item.status}`,
    ),
  };
};
