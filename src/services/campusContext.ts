import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface CampusContext {
  availableBooks: string[];
  upcomingEvents: string[];
  medicalAvailability: string[];
  availableDoctors: { id: string; name: string; specialty: string }[];
  recentLostFound: string[];
}

interface CampusContextRequest {
  books: boolean;
  events: boolean;
  doctors: boolean;
  lostFound: boolean;
}

const getRequestedContext = (requestText: string): CampusContextRequest => ({
  books: /\b(book|books|library|borrow|textbook|reading)\b/i.test(requestText),
  events: /\b(event|events|club|clubs|happening|calendar|activity|activities)\b/i.test(requestText),
  doctors:
    /\b(doctor|doctors|clinic|medical|appointment|appointments|health|nurse|medication)\b/i.test(
      requestText,
    ),
  lostFound: /\b(lost|found|missing|misplaced|lost\s*(and|&)\s*found)\b/i.test(requestText),
});

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
  requestText?: string,
): Promise<CampusContext> => {
  const requested = requestText
    ? getRequestedContext(requestText)
    : {
        books: true,
        events: true,
        doctors: true,
        lostFound: true,
      };
  const [books, events, doctors, lostItems] = await Promise.all([
    requested.books
      ? supabase.from("books").select("title, author").eq("available", true).limit(5)
      : Promise.resolve(null),
    requested.events
      ? supabase
          .from("club_events")
          .select("title, date")
          .gte("date", getCampusDate())
          .order("date", { ascending: true })
          .limit(5)
      : Promise.resolve(null),
    requested.doctors
      ? supabase
          .from("doctors")
          .select("id, name, specialty")
          .eq("available", true)
          .order("name")
          .limit(20)
      : Promise.resolve(null),
    requested.lostFound
      ? supabase
          .from("lost_found_items")
          .select("item_name, type, status")
          .order("date_reported", { ascending: false })
          .limit(5)
      : Promise.resolve(null),
  ]);

  const failedQuery = [
    ["available books", books?.error],
    ["upcoming events", events?.error],
    ["available doctors", doctors?.error],
    ["lost and found reports", lostItems?.error],
  ].find(([, error]) => error);
  if (failedQuery) {
    const [resource, error] = failedQuery;
    console.error(`Error fetching campus ${resource}:`, error);
    throw new Error(`Unable to fetch campus ${resource}.`);
  }
  return {
    availableBooks: (books?.data ?? []).map((book) => `${book.title} by ${book.author}`),
    upcomingEvents: (events?.data ?? []).map((event) => `${event.title} on ${event.date}`),
    medicalAvailability: (doctors?.data ?? []).map(
      (doctor) => `${doctor.name} (${doctor.specialty})`,
    ),
    availableDoctors: doctors?.data ?? [],
    recentLostFound: (lostItems?.data ?? []).map(
      (item) => `${item.item_name} (${item.type}) - ${item.status}`,
    ),
  };
};
