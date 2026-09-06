import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { CalendarDays, FileText, Plus, Trash2, Users, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Tab = "registry" | "members" | "events" | "resources";
type Club = Tables<"clubs">;
type Event = Tables<"club_events"> & { clubs: Pick<Club, "name"> | null };
type Resource = Tables<"resources">;
type Member = {
  user_id: string;
  joined_at: string;
  profiles: { full_name: string | null; email: string | null; student_id: string | null } | null;
};
type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  profile: { full_name: string | null; email: string | null; student_id: string | null } | null;
};
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
};
const tabs: { id: Tab; label: string }[] = [
  { id: "registry", label: "Registry" },
  { id: "members", label: "Member Roster" },
  { id: "events", label: "Campus Events" },
  { id: "resources", label: "Club Resources" },
];

const emptyClub = { name: "", description: "", dues: "Free", meeting_day: "TBD" };
const emptyEvent = { club_id: "", title: "", date: "", location: "", description: "", time: "" };
const emptyResource = { title: "", file_url: "" };

const ClubAdminPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("registry");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"club" | "event" | "resource" | null>(null);
  const [clubForm, setClubForm] = useState(emptyClub);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [resourceForm, setResourceForm] = useState(emptyResource);

  const loadData = async () => {
    setLoading(true);
    const [clubsResult, eventsResult, resourcesResult, registrationsResult] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("club_events").select("*, clubs(name)").order("date"),
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
      supabase.from("event_rsvps").select("id, event_id, user_id, created_at"),
    ]);
    const nextClubs = clubsResult.data || [];
    setClubs(nextClubs);
    setEvents(eventsResult.data || []);
    setResources(resourcesResult.data || []);
    const registrationRows = registrationsResult.data || [];
    const registrationIds = registrationRows.map((registration) => registration.user_id);
    const registrationProfiles = registrationIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, email, student_id")
          .in("id", registrationIds)
      : { data: [] };
    const registrationProfilesById = Object.fromEntries(
      (registrationProfiles.data || []).map((profile) => [profile.id, profile]),
    );
    setRegistrations(
      registrationRows.map((registration) => ({
        ...registration,
        profile: registrationProfilesById[registration.user_id] || null,
      })),
    );
    if (!selectedClub && nextClubs[0]) setSelectedClub(nextClubs[0].id);
    if (selectedClub) {
      const membershipResult = await supabase
        .from("club_memberships")
        .select("user_id, joined_at")
        .eq("club_id", selectedClub);
      const memberIds = (membershipResult.data || []).map((member) => member.user_id);
      const profilesResult = memberIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, email, student_id")
            .in("id", memberIds)
        : { data: [] };
      const profilesById = Object.fromEntries(
        (profilesResult.data || []).map((profile) => [profile.id, profile]),
      );
      setMembers(
        (membershipResult.data || []).map((member) => ({
          ...member,
          profiles: profilesById[member.user_id] || null,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedClub]);

  const registrationsForSelectedEvent = registrations.filter(
    (registration) => registration.event_id === selectedEvent,
  );

  const closeModal = () => setModal(null);
  const saveClub = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("clubs").insert({ ...clubForm, created_by: user?.id });
    if (error) {
      toast({ title: "Club creation failed", description: error.message, variant: "destructive" });
      return;
    }
    closeModal();
    setClubForm(emptyClub);
    toast({ title: "Club created", description: `${clubForm.name} is now in the registry.` });
    await loadData();
  };
  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("club_events").insert(eventForm);
    if (error) {
      toast({
        title: "Event publishing failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    closeModal();
    setEventForm(emptyEvent);
    toast({ title: "Event published", description: "Students can now register for this event." });
    await loadData();
  };
  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("resources")
      .insert({ ...resourceForm, uploaded_by: user.id });
    if (error) {
      toast({
        title: "Resource publishing failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    closeModal();
    setResourceForm(emptyResource);
    toast({ title: "Resource published", description: "The resource is now visible to students." });
    await loadData();
  };
  const remove = async (
    table: "clubs" | "club_events" | "resources",
    id: string,
    label: string,
  ) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Removal failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Removed", description: `${label} was removed.` });
    await loadData();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">Student Clubs Admin</h1>
            <p className="mt-2 text-muted-foreground">
              Manage student organizations and campus events
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setModal("club")}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-accent-foreground"
            >
              <Plus className="h-4 w-4" /> New Club
            </button>
            <button
              onClick={() => setModal("event")}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              <CalendarDays className="h-4 w-4" /> New Event
            </button>
          </div>
        </header>
        <div className="mt-10 overflow-x-auto border-b border-primary whitespace-nowrap">
          <div className="flex min-w-max gap-8">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium ${tab === item.id ? "border-accent text-primary" : "border-transparent text-muted-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading clubs...</div>
        ) : (
          <div className="py-8">
            {tab === "registry" && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {clubs.map((club) => (
                  <article
                    key={club.id}
                    className="relative rounded-lg border border-border bg-card p-8 shadow-usiu"
                  >
                    <button
                      aria-label={`Delete ${club.name}`}
                      onClick={() => remove("clubs", club.id, club.name)}
                      className="absolute right-7 top-7 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-accent">
                      <Users className="h-8 w-8" />
                    </div>
                    <h2 className="mt-6 text-xl font-bold text-primary">{club.name}</h2>
                    <p className="mt-3 min-h-12 text-sm text-muted-foreground">
                      {club.description || "No mission statement provided."}
                    </p>
                    <div className="mt-6 grid grid-cols-3 border-y border-border py-4 text-xs font-semibold text-primary">
                      <span>Members</span>
                      <span>{club.dues || "Free"}</span>
                      <span>{club.meeting_day || "TBD"}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClub(club.id);
                        setTab("members");
                      }}
                      className="mt-6 w-full rounded-md border border-primary py-3 font-semibold text-primary"
                    >
                      Manage Roster
                    </button>
                  </article>
                ))}
              </div>
            )}
            {tab === "members" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <select
                    value={selectedClub}
                    onChange={(event) => setSelectedClub(event.target.value)}
                    className="h-12 rounded-md border border-border bg-card px-4 text-foreground"
                  >
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
                  <table className="w-full min-w-[650px] text-left">
                    <thead className="bg-primary text-xs uppercase text-primary-foreground">
                      <tr>
                        <th className="px-5 py-4">Student</th>
                        <th className="px-5 py-4">Student ID</th>
                        <th className="px-5 py-4">Email</th>
                        <th className="px-5 py-4">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.user_id} className="border-t border-border">
                          <td className="px-5 py-4 font-semibold text-primary">
                            {member.profiles?.full_name || "Unknown"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {member.profiles?.student_id || "N/A"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {member.profiles?.email || "N/A"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {new Date(member.joined_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {members.length === 0 && (
                    <p className="py-12 text-center text-muted-foreground">
                      You haven't joined any clubs yet.
                    </p>
                  )}
                </div>
              </div>
            )}
            {tab === "events" && (
              <div className="space-y-8">
                <div className="grid gap-6 lg:grid-cols-2">
                  {events.map((event) => (
                    <article
                      key={event.id}
                      className={`relative rounded-lg border bg-card p-6 shadow-usiu ${selectedEvent === event.id ? "border-accent" : "border-border"}`}
                    >
                      <button
                        aria-label={`Delete ${event.title}`}
                        onClick={() => remove("club_events", event.id, event.title)}
                        className="absolute right-6 top-6 text-red-600"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      <p className="text-xs font-bold uppercase tracking-wide text-accent">
                        {event.clubs?.name || "Campus event"}
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-primary">{event.title}</h2>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {event.description || "No event description."}
                      </p>
                      <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString()}</span>
                        <span>{event.time || "TBD"}</span>
                        <span>{event.location || "Location TBD"}</span>
                      </div>
                      <button
                        onClick={() => setSelectedEvent(event.id)}
                        className="mt-5 w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground"
                      >
                        View Registrations (
                        {
                          registrations.filter((registration) => registration.event_id === event.id)
                            .length
                        }
                        )
                      </button>
                    </article>
                  ))}
                </div>
                {selectedEvent && (
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
                    <div className="flex items-center justify-between gap-4 border-b border-border p-5">
                      <h2 className="text-lg font-bold text-primary">Event Registrations</h2>
                      <span className="rounded-full bg-accent/20 px-3 py-1 text-sm font-bold text-primary">
                        {registrationsForSelectedEvent.length} registered
                      </span>
                    </div>
                    <table className="w-full min-w-[650px] text-left">
                      <thead className="bg-primary text-xs uppercase text-primary-foreground">
                        <tr>
                          <th className="px-5 py-4">Student</th>
                          <th className="px-5 py-4">Student ID</th>
                          <th className="px-5 py-4">Email</th>
                          <th className="px-5 py-4">Registered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrationsForSelectedEvent.map((registration) => (
                          <tr key={registration.id} className="border-t border-border">
                            <td className="px-5 py-4 font-semibold text-primary">
                              {registration.profile?.full_name || "Unknown student"}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">
                              {registration.profile?.student_id || "N/A"}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">
                              {registration.profile?.email || "N/A"}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">
                              {new Date(registration.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {registrationsForSelectedEvent.length === 0 && (
                      <p className="py-10 text-center text-muted-foreground">
                        No students have registered for this event yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === "resources" && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {resources.map((resource) => (
                  <article
                    key={resource.id}
                    className="relative rounded-lg border border-border bg-card p-6 shadow-usiu"
                  >
                    <button
                      aria-label={`Delete ${resource.title}`}
                      onClick={() => remove("resources", resource.id, resource.title)}
                      className="absolute right-6 top-6 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <FileText className="h-8 w-8 text-primary" />
                    <p className="mt-5 text-sm text-muted-foreground">
                      {new Date(resource.created_at).toLocaleDateString()}
                    </p>
                    <h2 className="mt-4 text-xl font-semibold text-primary">{resource.title}</h2>
                    {resource.file_url ? (
                      <a
                        href={resource.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 block font-semibold text-primary underline"
                      >
                        Open Resource
                      </a>
                    ) : (
                      <p className="mt-5 text-sm italic text-muted-foreground">Unpublished</p>
                    )}
                  </article>
                ))}
                <button
                  onClick={() => setModal("resource")}
                  className="flex min-h-52 items-center justify-center rounded-lg border-2 border-dashed border-primary/30 text-primary"
                >
                  <Plus className="mr-2 h-5 w-5" /> Upload New Guide
                </button>
              </div>
            )}
          </div>
        )}
        {modal === "club" && (
          <Modal title="Create Organization" onClose={closeModal}>
            <form onSubmit={saveClub} className="space-y-5">
              <Field
                label="Organization Name"
                value={clubForm.name}
                onChange={(value) => setClubForm({ ...clubForm, name: value })}
                required
              />
              <TextArea
                label="Mission Statement"
                value={clubForm.description}
                onChange={(value) => setClubForm({ ...clubForm, description: value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Dues"
                  value={clubForm.dues}
                  onChange={(value) => setClubForm({ ...clubForm, dues: value })}
                />
                <Field
                  label="Meeting Day"
                  value={clubForm.meeting_day}
                  onChange={(value) => setClubForm({ ...clubForm, meeting_day: value })}
                />
              </div>
              <Submit label="Register Club" />
            </form>
          </Modal>
        )}
        {modal === "event" && (
          <Modal title="Schedule Event" onClose={closeModal}>
            <form onSubmit={saveEvent} className="space-y-5">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Host Club
                <select
                  required
                  value={eventForm.club_id}
                  onChange={(event) => setEventForm({ ...eventForm, club_id: event.target.value })}
                  className="mt-2 h-12 w-full rounded-md border border-border px-4 text-sm normal-case tracking-normal"
                >
                  <option value="">Select Hosting Organization</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Event Title"
                value={eventForm.title}
                onChange={(value) => setEventForm({ ...eventForm, title: value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Date"
                  type="date"
                  value={eventForm.date}
                  onChange={(value) => setEventForm({ ...eventForm, date: value })}
                  required
                />
                <Field
                  label="Location"
                  value={eventForm.location}
                  onChange={(value) => setEventForm({ ...eventForm, location: value })}
                />
              </div>
              <Field
                label="Time"
                type="time"
                value={eventForm.time}
                onChange={(value) => setEventForm({ ...eventForm, time: value })}
              />
              <TextArea
                label="Description"
                value={eventForm.description}
                onChange={(value) => setEventForm({ ...eventForm, description: value })}
              />
              <Submit label="Publish Event" />
            </form>
          </Modal>
        )}
        {modal === "resource" && (
          <Modal title="New Club Asset" onClose={closeModal}>
            <form onSubmit={saveResource} className="space-y-5">
              <Field
                label="Asset Title"
                value={resourceForm.title}
                onChange={(value) => setResourceForm({ ...resourceForm, title: value })}
                required
              />
              <Field
                label="External Link"
                type="url"
                value={resourceForm.file_url}
                onChange={(value) => setResourceForm({ ...resourceForm, file_url: value })}
                placeholder="https://..."
              />
              <Submit label="Publish Asset" />
            </form>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

const Field = ({ label, value, onChange, ...props }: FieldProps) => (
  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
    {label}
    <input
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-12 w-full rounded-md border border-border px-4 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
    />
  </label>
);
const TextArea = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
    {label}
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
    />
  </label>
);
const Submit = ({ label }: { label: string }) => (
  <button className="w-full rounded-md bg-primary py-4 font-bold uppercase tracking-widest text-primary-foreground hover:bg-usiu-dark-blue">
    {label}
  </button>
);
const Modal = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4">
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card shadow-2xl">
      <div className="flex items-center justify-between bg-primary px-8 py-6 text-primary-foreground">
        <h2 className="text-xl font-bold uppercase">{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="p-8">{children}</div>
    </div>
  </div>
);

export default ClubAdminPage;
