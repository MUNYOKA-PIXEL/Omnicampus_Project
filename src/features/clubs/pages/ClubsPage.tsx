import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Download, FileText, Search, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Club = Tables<"clubs">;
type Event = Tables<"club_events"> & { clubs: Pick<Club, "name"> | null };
type Resource = Tables<"resources">;
type View = "registry" | "my-clubs" | "events" | "resources";

const tabs: { id: View; label: string }[] = [
  { id: "registry", label: "Registry" },
  { id: "my-clubs", label: "My Clubs" },
  { id: "events", label: "Campus Events" },
  { id: "resources", label: "Club Resources" },
];

const ClubsPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState<View>("registry");
  const [search, setSearch] = useState("");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [rsvps, setRsvps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadClubs = async () => {
    if (!user) return;
    setLoading(true);
    const [clubsResult, eventsResult, membershipResult, rsvpResult, resourcesResult] =
      await Promise.all([
        supabase.from("clubs").select("*").order("name"),
        supabase
          .from("club_events")
          .select("*, clubs(name)")
          .gte("date", new Date().toISOString().slice(0, 10))
          .order("date")
          .order("time"),
        supabase.from("club_memberships").select("club_id").eq("user_id", user.id),
        supabase.from("event_rsvps").select("event_id").eq("user_id", user.id),
        supabase.from("resources").select("*").order("created_at", { ascending: false }),
      ]);
    setClubs(clubsResult.data || []);
    setEvents((eventsResult.data || []) as Event[]);
    setMemberships((membershipResult.data || []).map((item) => item.club_id));
    setRsvps((rsvpResult.data || []).map((item) => item.event_id));
    setResources(resourcesResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadClubs();
  }, [user]);

  const filteredClubs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clubs.filter(
      (club) =>
        !query ||
        `${club.name} ${club.description || ""} ${club.meeting_day || ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [clubs, search]);

  const myClubs = useMemo(
    () => filteredClubs.filter((club) => memberships.includes(club.id)),
    [filteredClubs, memberships],
  );

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter(
      (event) =>
        !query ||
        `${event.title} ${event.description || ""} ${event.clubs?.name || ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [events, search]);

  const toggleMembership = async (club: Club) => {
    if (!user || busyId) return;
    setBusyId(club.id);
    const isMember = memberships.includes(club.id);
    const result = isMember
      ? await supabase
          .from("club_memberships")
          .delete()
          .eq("club_id", club.id)
          .eq("user_id", user.id)
      : await supabase.from("club_memberships").insert({ club_id: club.id, user_id: user.id });
    setBusyId(null);
    if (result.error) {
      toast({
        title: isMember ? "Could not leave club" : "Could not join club",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: isMember ? "Club left" : "Club joined",
      description: isMember ? `You left ${club.name}.` : `You joined ${club.name}.`,
    });
    await loadClubs();
  };

  const toggleRsvp = async (event: Event) => {
    if (!user || busyId) return;
    setBusyId(event.id);
    const isGoing = rsvps.includes(event.id);
    const result = isGoing
      ? await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", user.id)
      : await supabase.from("event_rsvps").insert({ event_id: event.id, user_id: user.id });
    setBusyId(null);
    if (result.error) {
      toast({
        title: isGoing ? "Could not cancel RSVP" : "Could not RSVP",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: isGoing ? "RSVP cancelled" : "RSVP confirmed",
      description: isGoing
        ? "You are no longer attending this event."
        : "This event was added to your plans.",
    });
    await loadClubs();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">Student Clubs</h1>
            <p className="mt-2 text-muted-foreground">
              Find your community and stay connected on campus
            </p>
          </div>
        </header>
        <div className="mt-10 overflow-x-auto border-b border-primary whitespace-nowrap">
          <div className="flex min-w-max gap-7">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setView(tab.id);
                  setSearch("");
                }}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${view === tab.id ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {view !== "resources" && (
          <label className="relative mt-8 block">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={view === "events" ? "Search events..." : "Search clubs..."}
              className="h-14 w-full rounded-md border border-border bg-card pl-12 pr-4 text-foreground outline-none focus:border-accent"
            />
          </label>
        )}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading clubs...</div>
        ) : view === "registry" || view === "my-clubs" ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(view === "registry" ? filteredClubs : myClubs).map((club) => {
              const isMember = memberships.includes(club.id);
              return (
                <article
                  key={club.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-usiu"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-lg bg-primary p-3 text-accent">
                      <Users className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {club.dues || "No dues"}
                    </span>
                  </div>
                  <h2 className="mt-6 text-xl font-bold text-primary">{club.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                    {club.description || "Connect with students who share your interests."}
                  </p>
                  <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                    {club.meeting_day || "Meeting schedule to be announced"}
                  </div>
                  <button
                    disabled={busyId !== null}
                    onClick={() => toggleMembership(club)}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold ${isMember ? "border border-primary bg-card text-primary" : "bg-primary text-primary-foreground hover:bg-usiu-dark-blue"}`}
                  >
                    {isMember && <Check className="h-4 w-4" />}
                    {busyId === club.id ? "Updating..." : isMember ? "Joined" : "Join Club"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : view === "events" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {filteredEvents.map((event) => {
              const isGoing = rsvps.includes(event.id);
              return (
                <article
                  key={event.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-usiu"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-accent">
                        {event.clubs?.name || "Campus event"}
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-primary">{event.title}</h2>
                    </div>
                    <CalendarDays className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {event.description || "Join your campus community for this event."}
                  </p>
                  <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString()}</span>
                    <span>{event.time || "Time to be announced"}</span>
                    <span className="sm:col-span-2">
                      {event.location || "Location to be announced"}
                    </span>
                  </div>
                  <button
                    disabled={busyId !== null}
                    onClick={() => toggleRsvp(event)}
                    className={`mt-5 w-full rounded-md py-3 font-semibold ${isGoing ? "border border-primary bg-card text-primary" : "bg-primary text-primary-foreground hover:bg-usiu-dark-blue"}`}
                  >
                    {busyId === event.id
                      ? "Updating..."
                      : isGoing
                        ? "Cancel RSVP"
                        : "RSVP to Event"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-lg border border-border bg-card p-6 shadow-usiu"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-md bg-muted p-3">
                    <FileText className="h-6 w-6 text-primary" />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(resource.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="mt-6 text-xl font-semibold text-primary">{resource.title}</h2>
                {resource.file_url ? (
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-md bg-muted py-3 font-semibold text-primary hover:bg-accent"
                  >
                    <Download className="h-4 w-4" /> Download Resource
                  </a>
                ) : (
                  <p className="mt-6 text-sm italic text-muted-foreground">Unpublished</p>
                )}
              </article>
            ))}
          </div>
        )}
        {!loading &&
          ((view === "registry" && filteredClubs.length === 0) ||
            (view === "my-clubs" && myClubs.length === 0) ||
            (view === "events" && filteredEvents.length === 0) ||
            (view === "resources" && resources.length === 0)) && (
            <p className="py-12 text-center text-muted-foreground">No clubs or events found.</p>
          )}
      </div>
    </DashboardLayout>
  );
};

export default ClubsPage;
