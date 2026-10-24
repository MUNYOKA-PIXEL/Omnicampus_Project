import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface CampusContext {
  availableBooks: { id: string; title: string; author: string | null }[];
  ownLoans: { id: string; title: string; due_date: string; status: string }[];
  ownBookRequests: { id: string; title: string; author: string | null; status: string }[];
  upcomingEvents: { id: string; title: string; date: string; time: string | null; club: string }[];
  clubs: { id: string; name: string; description: string | null; dues: string | null }[];
  ownClubMembershipIds: string[];
  ownEventRsvpIds: string[];
  medicalAvailability: string[];
  availableDoctors: { id: string; name: string; specialty: string }[];
  medications: { id: string; name: string; type: string; price: string }[];
  ownAppointments: {
    id: string;
    date: string;
    time: string;
    status: string;
    doctor: string;
  }[];
  recentLostFound: string[];
  ownLostFoundReports: {
    id: string;
    item_name: string;
    type: string;
    status: string;
  }[];
}

interface CampusContextRequest {
  books: boolean;
  events: boolean;
  doctors: boolean;
  lostFound: boolean;
  clubs: boolean;
  medications: boolean;
}

export const getRequestedContext = (requestText: string): CampusContextRequest => ({
  books:
    /\b(book(?!\s+(?:an?\s+)?appointment)|books|library|borrow|textbook|reading|loan|request(?:ing)? (?:a )?book)\b/i.test(
      requestText,
    ),
  events: /\b(event|events|happening|calendar|activity|activities|rsvp|attending)\b/i.test(
    requestText,
  ),
  doctors:
    /\b(doctor|doctors|clinic|medical|appointment|appointments|health|nurse|cancel(?:ling)? (?:my )?appointment)\b/i.test(
      requestText,
    ),
  lostFound: /\b(lost|found|missing|misplaced|lost\s*(and|&)\s*found)\b/i.test(requestText),
  clubs: /\b(club|clubs|member|membership|join|leave)\b/i.test(requestText),
  medications: /\b(pharmacy|medication|medicine|medicines|drug)\b/i.test(requestText),
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
  userId?: string,
): Promise<CampusContext> => {
  const requested = requestText
    ? getRequestedContext(requestText)
    : {
        books: true,
        events: true,
        doctors: true,
        lostFound: true,
        clubs: true,
        medications: true,
      };
  const [
    books,
    loans,
    bookRequests,
    events,
    clubs,
    memberships,
    rsvps,
    doctors,
    appointments,
    medications,
    lostItems,
    ownLostItems,
  ] = await Promise.all([
    requested.books
      ? supabase.from("books").select("id, title, author").eq("available", true).limit(50)
      : Promise.resolve(null),
    requested.books && userId
      ? supabase
          .from("book_loans")
          .select("id, due_date, status, books(title)")
          .eq("user_id", userId)
          .order("issue_date", { ascending: false })
          .limit(20)
      : Promise.resolve(null),
    requested.books && userId
      ? supabase
          .from("book_requests")
          .select("id, title, author, status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve(null),
    requested.events
      ? supabase
          .from("club_events")
          .select("id, title, date, time, clubs(name)")
          .gte("date", getCampusDate())
          .order("date", { ascending: true })
          .limit(50)
      : Promise.resolve(null),
    requested.clubs
      ? supabase.from("clubs").select("id, name, description, dues").order("name").limit(50)
      : Promise.resolve(null),
    requested.clubs && userId
      ? supabase.from("club_memberships").select("club_id").eq("user_id", userId)
      : Promise.resolve(null),
    requested.events && userId
      ? supabase.from("event_rsvps").select("event_id").eq("user_id", userId)
      : Promise.resolve(null),
    requested.doctors
      ? supabase
          .from("doctors")
          .select("id, name, specialty")
          .eq("available", true)
          .order("name")
          .limit(20)
      : Promise.resolve(null),
    requested.doctors && userId
      ? supabase
          .from("appointments")
          .select("id, date, time, status, doctors(name)")
          .eq("user_id", userId)
          .order("date", { ascending: true })
          .limit(20)
      : Promise.resolve(null),
    requested.medications
      ? supabase
          .from("medications")
          .select("id, name, type, price")
          .eq("available", true)
          .order("name")
          .limit(30)
      : Promise.resolve(null),
    requested.lostFound
      ? supabase
          .from("lost_found_items")
          .select("id, item_name, type, status")
          .order("date_reported", { ascending: false })
          .limit(5)
      : Promise.resolve(null),
    requested.lostFound && userId
      ? supabase
          .from("lost_found_items")
          .select("id, item_name, type, status")
          .eq("user_id", userId)
          .order("date_reported", { ascending: false })
          .limit(20)
      : Promise.resolve(null),
  ]);

  const failedQuery = [
    ["available books", books?.error],
    ["your library loans", loans?.error],
    ["your book requests", bookRequests?.error],
    ["upcoming events", events?.error],
    ["clubs", clubs?.error],
    ["your club memberships", memberships?.error],
    ["your event RSVPs", rsvps?.error],
    ["available doctors", doctors?.error],
    ["your appointments", appointments?.error],
    ["available medications", medications?.error],
    ["lost and found reports", lostItems?.error],
    ["your lost and found reports", ownLostItems?.error],
  ].find(([, error]) => error);
  if (failedQuery) {
    const [resource, error] = failedQuery;
    console.error(`Error fetching campus ${resource}:`, error);
    throw new Error(`Unable to fetch campus ${resource}.`);
  }
  return {
    availableBooks: books?.data ?? [],
    ownLoans: (loans?.data ?? []).map((loan) => ({
      id: loan.id,
      title: loan.books?.title ?? "Unknown book",
      due_date: loan.due_date,
      status: loan.status,
    })),
    ownBookRequests: bookRequests?.data ?? [],
    upcomingEvents: (events?.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      club: event.clubs?.name ?? "Campus event",
    })),
    clubs: clubs?.data ?? [],
    ownClubMembershipIds: (memberships?.data ?? []).map((membership) => membership.club_id),
    ownEventRsvpIds: (rsvps?.data ?? []).map((rsvp) => rsvp.event_id),
    medicalAvailability: (doctors?.data ?? []).map(
      (doctor) => `${doctor.name} (${doctor.specialty})`,
    ),
    availableDoctors: doctors?.data ?? [],
    medications: medications?.data ?? [],
    ownAppointments: (appointments?.data ?? []).map((appointment) => ({
      id: appointment.id,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      doctor: appointment.doctors?.name ?? "Unknown practitioner",
    })),
    recentLostFound: (lostItems?.data ?? []).map(
      (item) => `${item.item_name} (${item.type}) - ${item.status}`,
    ),
    ownLostFoundReports: ownLostItems?.data ?? [],
  };
};
