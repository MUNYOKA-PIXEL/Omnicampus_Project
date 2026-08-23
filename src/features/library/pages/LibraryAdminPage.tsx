// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, FilePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Tab = "inventory" | "loans" | "requests" | "resources";

const tabs: { id: Tab; label: string }[] = [
  { id: "inventory", label: "Inventory" },
  { id: "loans", label: "Active Loans" },
  { id: "requests", label: "Acquisition Requests" },
  { id: "resources", label: "Digital Resources" },
];

const emptyBook = { title: "", author: "", category: "", copies: 1 };
const emptyResource = { title: "", file_url: "" };
const formatDate = (date: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString() : "-";

const LibraryAdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("inventory");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [books, setBooks] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [booksResult, loansResult, requestsResult, resourcesResult, profilesResult] = await Promise.all([
      supabase.from("books").select("*").order("title"),
      supabase.from("book_loans").select("*").order("due_date"),
      supabase.from("book_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, student_id"),
    ]);
    setBooks(booksResult.data || []);
    setLoans(loansResult.data || []);
    setRequests(requestsResult.data || []);
    setResources(resourcesResult.data || []);
    setProfiles(Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile])));
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const categories = useMemo(() => ["all", ...Array.from(new Set(books.map((book) => book.category).filter(Boolean)))], [books]);
  const filteredBooks = books.filter((book) => {
    const query = search.trim().toLowerCase();
    return (!query || `${book.title} ${book.author}`.toLowerCase().includes(query)) && (category === "all" || book.category === category);
  });

  const openNewBook = () => { setEditingBook(null); setBookForm(emptyBook); setIsBookModalOpen(true); };
  const openEditBook = (book: any) => { setEditingBook(book); setBookForm({ title: book.title, author: book.author, category: book.category, copies: book.copies }); setIsBookModalOpen(true); };
  const saveBook = async (event: React.FormEvent) => {
    event.preventDefault();
    const copies = Math.max(0, Number(bookForm.copies) || 0);
    const payload = { title: bookForm.title.trim(), author: bookForm.author.trim(), category: bookForm.category.trim(), copies, available: copies > 0 };
    const result = editingBook ? await supabase.from("books").update(payload).eq("id", editingBook.id) : await supabase.from("books").insert(payload);
    if (result.error) { toast({ title: "Book save failed", description: result.error.message, variant: "destructive" }); return; }
    setIsBookModalOpen(false);
    toast({ title: editingBook ? "Book updated" : "Book added", description: `${payload.title} is now in the inventory.` });
    await loadData();
  };
  const deleteBook = async (book: any) => {
    if (!window.confirm(`Delete ${book.title} from inventory?`)) return;
    const { error } = await supabase.from("books").delete().eq("id", book.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Book deleted", description: `${book.title} was removed.` });
    await loadData();
  };
  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("resources").insert({ title: resourceForm.title.trim(), file_url: resourceForm.file_url.trim() || null, uploaded_by: user.id });
    if (error) { toast({ title: "Resource save failed", description: error.message, variant: "destructive" }); return; }
    setResourceForm(emptyResource); setIsResourceModalOpen(false);
    toast({ title: "Resource added", description: "The digital resource is now available to students." });
    await loadData();
  };
  const updateRequest = async (request: any, status: string) => {
    const { error } = await supabase.from("book_requests").update({ status }).eq("id", request.id);
    if (error) { toast({ title: "Request update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Request updated", description: `Request marked ${status}.` });
    await loadData();
  };

  return <DashboardLayout>
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div><h1 className="text-3xl font-bold text-primary sm:text-4xl">Library Admin</h1><p className="mt-2 text-muted-foreground">Manage campus inventory and circulation</p></div>
        <div className="flex flex-wrap gap-3"><button onClick={openNewBook} className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-accent-foreground"><Plus className="h-4 w-4" /> Add New Book</button><button onClick={() => setIsResourceModalOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"><FilePlus className="h-4 w-4" /> Add Resource</button></div>
      </header>
      <div className="mt-10 flex flex-col gap-3 lg:flex-row"><label className="relative block flex-1"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, author..." className="h-14 w-full rounded-md border border-border bg-card pl-12 pr-4 outline-none focus:border-accent" /></label><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-14 rounded-md border border-border bg-card px-4 outline-none focus:border-accent">{categories.map((item) => <option key={item} value={item}>{item === "all" ? "All Categories" : item}</option>)}</select></div>
      <div className="mt-8 overflow-x-auto border-b border-primary whitespace-nowrap"><div className="flex min-w-max gap-8">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-1 pb-3 text-sm font-medium ${activeTab === tab.id ? "border-accent text-primary" : "border-transparent text-muted-foreground"}`}>{tab.label}</button>)}</div></div>
      {isLoading ? <div className="py-20 text-center text-muted-foreground">Loading library...</div> : <div className="py-8">
        {activeTab === "inventory" && <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{filteredBooks.map((book) => <article key={book.id} className="relative overflow-hidden rounded-lg border border-border bg-card shadow-usiu"><div className="flex h-40 items-center justify-center bg-primary"><BookOpen className="h-14 w-14 text-accent" /><button aria-label={`Delete ${book.title}`} onClick={() => deleteBook(book)} className="absolute right-4 top-4 rounded-full bg-red-950/60 p-2 text-red-400 hover:bg-red-700 hover:text-white"><Trash2 className="h-4 w-4" /></button></div><div className="p-6"><h2 className="text-xl font-semibold text-primary">{book.title}</h2><p className="mt-1 text-sm text-muted-foreground">By {book.author}</p><div className="mt-5 flex items-center justify-between"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary">{book.category}</span><span className="font-semibold text-green-700">{book.copies} Copies</span></div><div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => openEditBook(book)} className="inline-flex items-center justify-center gap-2 rounded-md border border-primary py-3 font-semibold text-primary"><Pencil className="h-4 w-4" /> Edit</button><button onClick={() => openEditBook(book)} className="rounded-md bg-primary py-3 font-semibold text-primary-foreground">Restock</button></div></div></article>)}</div>}
        {activeTab === "loans" && <DataTable headers={["Book Title", "Student ID", "Due Date", "Status", "Actions"]}>{loans.filter((loan) => loan.status !== "returned").map((loan) => { const student = profiles[loan.user_id]; return <tr key={loan.id} className="border-t border-border"><td className="px-5 py-4 font-semibold text-primary">{books.find((book) => book.id === loan.book_id)?.title || "Unknown book"}</td><td className="px-5 py-4 text-muted-foreground">{student?.student_id || "N/A"}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(loan.due_date)}</td><td className="px-5 py-4"><span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase text-yellow-800">{loan.status}</span></td><td className="px-5 py-4 text-sm text-muted-foreground">Update in library system</td></tr>; })}</DataTable>}
        {activeTab === "requests" && <DataTable headers={["Requested Book", "Student ID", "Reason", "Date", "Status", "Decision"]}>{requests.map((request) => { const student = profiles[request.user_id]; return <tr key={request.id} className="border-t border-border"><td className="px-5 py-4 font-semibold text-primary">{request.title}</td><td className="px-5 py-4 text-muted-foreground">{student?.student_id || "N/A"}</td><td className="max-w-xs px-5 py-4 text-sm text-muted-foreground">{request.reason || "-"}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(request.created_at?.slice(0, 10))}</td><td className="px-5 py-4"><span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase text-yellow-800">{request.status}</span></td><td className="px-5 py-4"><div className="flex gap-2"><button disabled={request.status !== "pending"} onClick={() => updateRequest(request, "approved")} className="rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve</button><button disabled={request.status !== "pending"} onClick={() => updateRequest(request, "rejected")} className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Reject</button></div></td></tr>; })}</DataTable>}
        {activeTab === "resources" && <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{resources.map((resource) => <article key={resource.id} className="rounded-lg border border-border bg-card p-6 shadow-usiu"><div className="flex items-start justify-between"><span className="rounded-md bg-muted p-3"><BookOpen className="h-6 w-6 text-primary" /></span><span className="text-sm text-muted-foreground">{formatDate(resource.created_at?.slice(0, 10))}</span></div><h2 className="mt-6 text-xl font-semibold text-primary">{resource.title}</h2>{resource.file_url ? <a href={resource.file_url} target="_blank" rel="noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-md bg-muted py-3 font-semibold text-primary"><Download className="h-4 w-4" /> Download Guide</a> : <p className="mt-6 text-center text-sm italic text-muted-foreground">No file attached</p>}</article>)}</div>}
        {((activeTab === "inventory" && filteredBooks.length === 0) || (activeTab === "loans" && loans.filter((loan) => loan.status !== "returned").length === 0) || (activeTab === "requests" && requests.length === 0) || (activeTab === "resources" && resources.length === 0)) && <p className="py-12 text-center text-muted-foreground">No records to display yet.</p>}
      </div>}
    </div>
    {isBookModalOpen && <Modal title={editingBook ? "Edit Inventory" : "Add New Inventory"} onClose={() => setIsBookModalOpen(false)}><form onSubmit={saveBook} className="space-y-5"><Field label="Book title" value={bookForm.title} onChange={(value) => setBookForm({ ...bookForm, title: value })} placeholder="e.g. Advanced Database Systems" required /><Field label="Author name" value={bookForm.author} onChange={(value) => setBookForm({ ...bookForm, author: value })} placeholder="e.g. Dr. Jane Smith" required /><div className="grid grid-cols-2 gap-4"><Field label="Category" value={bookForm.category} onChange={(value) => setBookForm({ ...bookForm, category: value })} placeholder="e.g. CS" required /><Field label="Total copies" type="number" value={bookForm.copies} onChange={(value) => setBookForm({ ...bookForm, copies: value })} min="0" required /></div><button className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground">{editingBook ? "Save Changes" : "Confirm & Add Book"}</button></form></Modal>}
    {isResourceModalOpen && <Modal title="New Digital Resource" onClose={() => setIsResourceModalOpen(false)}><form onSubmit={saveResource} className="space-y-5"><Field label="Resource title" value={resourceForm.title} onChange={(value) => setResourceForm({ ...resourceForm, title: value })} placeholder="e.g. Exam Revision Guide 2026" required /><Field label="External URL / file link" type="url" value={resourceForm.file_url} onChange={(value) => setResourceForm({ ...resourceForm, file_url: value })} placeholder="https://..." /><button className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground">Upload Resource</button></form></Modal>}
  </DashboardLayout>;
};

const DataTable = ({ headers, children }: any) => <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu"><table className="w-full min-w-[700px] text-left"><thead className="bg-primary text-xs uppercase text-primary-foreground"><tr>{headers.map((header: string) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
const Field = ({ label, value, onChange, ...props }: any) => <label className="block text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}<input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent" /></label>;
const Modal = ({ title, onClose, children }: any) => <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"><div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground"><h2 className="text-xl font-bold">{title}</h2><button aria-label="Close dialog" onClick={onClose}><X className="h-6 w-6" /></button></div><div className="p-6">{children}</div></div></div>;

export default LibraryAdminPage;
