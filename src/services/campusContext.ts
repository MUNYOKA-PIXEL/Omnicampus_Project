// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export interface CampusContext {
  availableBooks: string[];
  upcomingEvents: string[];
  medicalAvailability: string[];
  recentLostFound: string[];
}

export const getCampusContext = async (): Promise<CampusContext> => {
  try {
    const [books, events, doctors, lostItems] = await Promise.all([
      supabase.from("books").select("title, author").eq("available", true).limit(5),
      supabase.from("club_events").select("title, date").gte("date", new Date().toISOString()).limit(5),
      supabase.from("doctors").select("name, specialty").eq("available", true),
      supabase.from("lost_found_items").select("item_name, type, status").order("date_reported", { ascending: false }).limit(5),
    ]);

    return {
      availableBooks: books.data?.map(b => `${b.title} by ${b.author}`) || [],
      upcomingEvents: events.data?.map(e => `${e.title} on ${new Date(e.date).toLocaleDateString()}`) || [],
      medicalAvailability: doctors.data?.map(d => `${d.name} (${d.specialty})`) || [],
      recentLostFound: lostItems.data?.map(i => `${i.item_name} (${i.type}) - ${i.status}`) || [],
    };
  } catch (error) {
    console.error("Error fetching campus context:", error);
    return {
      availableBooks: [],
      upcomingEvents: [],
      medicalAvailability: [],
      recentLostFound: [],
    };
  }
};
