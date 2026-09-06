import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Handshake,
  Percent,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Item = Tables<"lost_found_items">;
type Tab = "all" | "lost" | "found" | "matches" | "mine";
type ReportType = "lost" | "found";
type Match = { lost: Item; found: Item; score: number };
const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All Items" },
  { id: "lost", label: "Lost Items" },
  { id: "found", label: "Found Items" },
  { id: "matches", label: "Potential Matches" },
  { id: "mine", label: "My Reports" },
];
const emptyForm = { item_name: "", description: "", location: "", date_reported: "" };

const LostFoundPage = () => {
  const { user, role } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("lost_found_items")
      .select("*")
      .order("date_reported", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => {
    loadItems();
  }, [user]);

  const isType = (item: Item, type: "lost" | "found") => item.type.trim().toLowerCase() === type;
  const isOpen = (item: Item) => {
    const status = item.status.trim().toLowerCase();
    return status === "open" || status === "searching";
  };
  const lostItems = items.filter((item) => isType(item, "lost"));
  const foundItems = items.filter((item) => isType(item, "found"));
  const mine = items.filter((item) => item.user_id === user?.id);
  const recoveryRate = foundItems.length
    ? Math.round(
        (foundItems.filter((item) => item.status !== "open").length / foundItems.length) * 100,
      )
    : 0;
  const potentialMatches = useMemo<Match[]>(() => {
    const ignoredWords = new Set(["the", "and", "with", "item", "color", "in", "of"]);
    const normalize = (value: string | null) =>
      (value || "")
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((word) => word.length > 2 && !ignoredWords.has(word)) || [];
    const matches: Match[] = [];
    for (const lost of lostItems.filter(isOpen)) {
      for (const found of foundItems.filter(isOpen)) {
        const lostText = `${lost.item_name} ${lost.description || ""}`.toLowerCase();
        const foundText = `${found.item_name} ${found.description || ""}`.toLowerCase();
        const lostWords = normalize(lostText);
        const foundWords = normalize(foundText);
        const shared = lostWords.filter((word) =>
          foundWords.some(
            (foundWord) =>
              foundWord === word || foundWord.includes(word) || word.includes(foundWord),
          ),
        );
        const nameOverlap =
          lost.item_name.trim().length > 2 &&
          foundText.includes(lost.item_name.trim().toLowerCase());
        if (shared.length > 0 || nameOverlap) {
          matches.push({ lost, found, score: Math.max(shared.length, nameOverlap ? 1 : 0) });
        }
      }
    }
    return matches.sort((a, b) => b.score - a.score);
  }, [foundItems, lostItems]);
  const filteredItems = useMemo(() => {
    const source =
      tab === "lost"
        ? lostItems
        : tab === "found"
          ? foundItems
          : tab === "mine"
            ? mine
            : tab === "matches"
              ? []
              : items;
    const query = search.trim().toLowerCase();
    return source.filter(
      (item) =>
        !query ||
        `${item.item_name} ${item.description || ""} ${item.location || ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [items, mine, foundItems, lostItems, search, tab]);

  const openReport = (type: ReportType) => {
    setReportType(type);
    setForm({ ...emptyForm, date_reported: new Date().toISOString().slice(0, 10) });
    setImage(null);
  };
  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !reportType) return;
    setSaving(true);
    let imageUrl: string | null = null;
    if (image) {
      const extension = image.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage
        .from("lost-found-images")
        .upload(path, image, { upsert: false });
      if (upload.error) {
        setSaving(false);
        toast({
          title: "Image upload failed",
          description: upload.error.message,
          variant: "destructive",
        });
        return;
      }
      imageUrl = supabase.storage.from("lost-found-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase
      .from("lost_found_items")
      .insert({ ...form, type: reportType, user_id: user.id, image_url: imageUrl });
    setSaving(false);
    if (error) {
      toast({ title: "Report failed", description: error.message, variant: "destructive" });
      return;
    }
    setReportType(null);
    setForm(emptyForm);
    setImage(null);
    toast({ title: "Report submitted", description: "Your report is now visible on campus." });
    await loadItems();
  };

  const markAsFound = async (item: Item) => {
    if (!user || (item.user_id !== user.id && role !== "superadmin")) return;
    const { error } = await supabase
      .from("lost_found_items")
      .update({ status: "resolved" })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Could not update item", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: item.type === "found" ? "Item marked claimed" : "Item marked found",
      description: "The report is no longer shown as searching.",
    });
    setSelectedItem(null);
    await loadItems();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">Lost &amp; Found System</h1>
            <p className="mt-2 text-muted-foreground">
              Help reunite campus items with their owners
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => openReport("lost")}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              <TriangleAlert className="h-4 w-4" /> Report Lost
            </button>
            <button
              onClick={() => openReport("found")}
              className="inline-flex items-center gap-2 rounded-md border border-primary px-5 py-3 font-semibold text-primary"
            >
              <CheckCircle2 className="h-4 w-4" /> Report Found
            </button>
          </div>
        </header>
        <section className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Summary
            icon={Clock3}
            value={lostItems.length}
            label="Lost Items"
            active={tab === "lost"}
            onClick={() => setTab("lost")}
          />
          <Summary
            icon={Check}
            value={foundItems.length}
            label="Found Items"
            active={tab === "found"}
            onClick={() => setTab("found")}
          />
          <Summary
            icon={Handshake}
            value={potentialMatches.length}
            label="Potential Matches"
            active={tab === "matches"}
            onClick={() => setTab("matches")}
          />
          <Summary
            icon={Percent}
            value={`${recoveryRate}%`}
            label="Recovery Rate"
            active={false}
            onClick={() => setTab("all")}
          />
        </section>
        <div className="mt-10 overflow-x-auto border-b border-primary whitespace-nowrap">
          <div className="flex min-w-max gap-8">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium ${tab === item.id ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <label className="relative mt-8 block">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items..."
            className="h-14 w-full rounded-md border border-border bg-card pl-12 pr-4 text-foreground outline-none focus:border-accent"
          />
        </label>
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading reports...</div>
        ) : tab === "matches" ? (
          <div className="mt-8 space-y-4">
            {potentialMatches.map((match) => (
              <button
                key={`${match.lost.id}-${match.found.id}`}
                onClick={() => setSelectedItem(match.lost)}
                className="block w-full rounded-lg border border-border bg-card p-5 text-left shadow-usiu hover:border-accent"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-accent">
                  Potential match
                </p>
                <p className="mt-2 font-semibold text-primary">Lost: {match.lost.item_name}</p>
                <p className="text-sm text-muted-foreground">Found: {match.found.item_name}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Shared description/name terms: {match.score}
                </p>
              </button>
            ))}
            {potentialMatches.length === 0 && (
              <p className="py-20 text-center text-muted-foreground">No potential matches found.</p>
            )}
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-primary text-xs uppercase text-primary-foreground">
                <tr>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="cursor-pointer border-t border-border hover:bg-muted/50"
                  >
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold lowercase text-green-700">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-primary">{item.item_name}</td>
                    <td className="max-w-xs px-5 py-4 text-muted-foreground">
                      {item.description || "-"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{item.location || "-"}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(`${item.date_reported}T00:00:00`).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold lowercase text-yellow-800">
                        {item.status === "open"
                          ? "searching"
                          : item.status === "resolved"
                            ? item.type === "lost"
                              ? "found"
                              : "claimed"
                            : item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-primary">
                      <span>View</span>
                      {(item.type === "lost" || item.type === "found") &&
                        item.status === "open" &&
                        (item.user_id === user?.id || role === "superadmin") && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsFound(item);
                            }}
                            className="ml-3 text-sm text-primary underline"
                          >
                            {item.type === "lost" ? "Mark found" : "Mark claimed"}
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No items to display</p>
            )}
          </div>
        )}
        {reportType && (
          <Modal
            title={`Report ${reportType === "lost" ? "Lost" : "Found"} Item`}
            onClose={() => setReportType(null)}
          >
            <form onSubmit={submitReport} className="space-y-5">
              <Field
                label="Item Name"
                value={form.item_name}
                placeholder={reportType === "lost" ? "What did you lose?" : "What did you find?"}
                onChange={(value) => setForm({ ...form, item_name: value })}
                required
              />
              <TextArea
                label="Description"
                value={form.description}
                placeholder="Describe the item"
                onChange={(value) => setForm({ ...form, description: value })}
              />
              <Field
                label={reportType === "lost" ? "Last Seen Location" : "Found Location"}
                value={form.location}
                placeholder={
                  reportType === "lost" ? "Where did you last see it?" : "Where did you find it?"
                }
                onChange={(value) => setForm({ ...form, location: value })}
              />
              <Field
                label={reportType === "lost" ? "Date Lost" : "Date Found"}
                type="date"
                value={form.date_reported}
                onChange={(value) => setForm({ ...form, date_reported: value })}
                required
              />
              <label className="block text-sm font-semibold text-muted-foreground">
                Attach image (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  className="mt-2 block w-full rounded-md border border-border px-4 py-3 text-sm text-foreground"
                />
              </label>
              <Submit label={saving ? "Submitting..." : "Submit Report"} disabled={saving} />
            </form>
          </Modal>
        )}
        {selectedItem && (
          <Modal
            title={`${selectedItem.type === "lost" ? "Lost" : "Found"} Item Details`}
            onClose={() => setSelectedItem(null)}
          >
            <div className="space-y-4">
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.item_name}
                  className="max-h-64 w-full rounded-lg object-contain"
                />
              )}
              <h2 className="text-2xl font-bold text-primary">{selectedItem.item_name}</h2>
              <p className="text-muted-foreground">
                {selectedItem.description || "No description provided."}
              </p>
              <p className="text-sm text-muted-foreground">
                Location: {selectedItem.location || "Not provided"}
              </p>
              <p className="text-sm text-muted-foreground">
                Reported: {new Date(`${selectedItem.date_reported}T00:00:00`).toLocaleDateString()}
              </p>
              {(selectedItem.type === "lost" || selectedItem.type === "found") &&
                selectedItem.status === "open" &&
                (selectedItem.user_id === user?.id || role === "superadmin") && (
                  <button
                    onClick={() => markAsFound(selectedItem)}
                    className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground"
                  >
                    {selectedItem.type === "lost" ? "Mark Item as Found" : "Mark Item as Claimed"}
                  </button>
                )}
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

const Summary = ({ icon: Icon, value, label, active, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-5 rounded-lg border bg-card p-7 text-left shadow-usiu transition hover:-translate-y-0.5 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent ${active ? "border-accent" : "border-border"}`}
  >
    <span className="rounded-md bg-muted p-4">
      <Icon className="h-9 w-9 text-primary" />
    </span>
    <span>
      <strong className="block text-3xl text-primary">{value}</strong>
      <span className="text-sm text-muted-foreground">{label}</span>
    </span>
  </button>
);
const Field = ({ label, value, onChange, ...props }: any) => (
  <label className="block text-sm font-semibold text-muted-foreground">
    {label}
    <input
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-14 w-full rounded-md border border-border px-4 font-normal text-foreground outline-none focus:border-accent"
    />
  </label>
);
const TextArea = ({ label, value, onChange, placeholder }: any) => (
  <label className="block text-sm font-semibold text-muted-foreground">
    {label}
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      className="mt-2 w-full rounded-md border border-border px-4 py-3 font-normal text-foreground outline-none focus:border-accent"
    />
  </label>
);
const Submit = ({ label, disabled }: { label: string; disabled?: boolean }) => (
  <button
    disabled={disabled}
    className="w-full rounded-md bg-primary py-4 font-semibold text-primary-foreground disabled:opacity-60"
  >
    {label}
  </button>
);
const Modal = ({ title, onClose, children }: any) => (
  <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4">
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-card shadow-2xl">
      <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
        <h2 className="text-xl font-bold">{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

export default LostFoundPage;
