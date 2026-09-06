import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Download, Plus, Search, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Tab = "available" | "loans" | "requests" | "resources";
type RequestForm = { title: string; author: string; reason: string };
type Book = Tables<"books">;
type Loan = Tables<"book_loans"> & { books: Pick<Book, "title" | "author"> | null };
type BookRequest = Tables<"book_requests">;
type Resource = Tables<"resources">;

const tabs: { id: Tab; label: string }[] = [
  { id: "available", label: "Available Books" },
  { id: "loans", label: "My Loans" },
  { id: "requests", label: "My Requests" },
  { id: "resources", label: "Digital Resources" },
];

const emptyRequest: RequestForm = { title: "", author: "", reason: "" };

const formatDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString() : "-";

const statusClass = (status: string) => {
  if (status === "overdue") return "bg-red-100 text-red-700";
  if (status === "returned" || status === "approved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-800";
};

const LibraryPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBorrowing, setIsBorrowing] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequest);

  const loadLibraryData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [booksResult, loansResult, requestsResult, resourcesResult] = await Promise.all([
      supabase.from("books").select("*").eq("available", true).order("title"),
      supabase
        .from("book_loans")
        .select("*, books(title, author)")
        .eq("user_id", user.id)
        .order("issue_date", { ascending: false }),
      supabase
        .from("book_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("resources").select("*").order("created_at", { ascending: false }),
    ]);
    setBooks(booksResult.data || []);
    setLoans(loansResult.data || []);
    setRequests(requestsResult.data || []);
    setResources(resourcesResult.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLibraryData();
  }, [user]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(books.map((book) => book.category).filter(Boolean)))],
    [books],
  );

  const filteredBooks = books.filter((book) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${book.title} ${book.author}`.toLowerCase().includes(query);
    return matchesSearch && (category === "all" || book.category === category);
  });

  const borrowBook = async (book: Book) => {
    if (!user || isBorrowing) return;
    setIsBorrowing(book.id);
    const { error } = await supabase.rpc("borrow_book", { book_id_input: book.id });
    setIsBorrowing(null);
    if (error) {
      toast({ title: "Borrowing failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Book borrowed",
      description: `${book.title} is due in 14 days.`,
    });
    await loadLibraryData();
  };

  const submitBookRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !requestForm.title.trim()) return;
    setIsRequesting(true);
    const { error } = await supabase.from("book_requests").insert({
      user_id: user.id,
      title: requestForm.title.trim(),
      author: requestForm.author.trim() || null,
      reason: requestForm.reason.trim() || null,
    });
    setIsRequesting(false);
    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
      return;
    }
    setRequestForm(emptyRequest);
    setIsRequestModalOpen(false);
    toast({
      title: "Request submitted",
      description: "The library team will review your request.",
    });
    await loadLibraryData();
  };

  const contentIsEmpty =
    (activeTab === "available" && filteredBooks.length === 0) ||
    (activeTab === "loans" && loans.length === 0) ||
    (activeTab === "requests" && requests.length === 0) ||
    (activeTab === "resources" && resources.length === 0);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">Library Management</h1>
            <p className="mt-2 text-muted-foreground">Browse and borrow campus books</p>
          </div>
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-sm hover:bg-usiu-dark-blue"
          >
            <Plus className="h-4 w-4" /> Request Book
          </button>
        </header>

        <div className="mt-10 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author..."
              className="h-14 w-full rounded-md border border-border bg-card pl-12 pr-4 text-foreground outline-none focus:border-accent"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-14 rounded-md border border-border bg-card px-4 text-foreground outline-none focus:border-accent"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All Categories" : item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 overflow-x-auto border-b border-primary whitespace-nowrap">
          <div className="flex min-w-max gap-7">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading library...</div>
        ) : (
          <div className="py-8">
            {activeTab === "available" && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBooks.map((book) => (
                  <article
                    key={book.id}
                    className="overflow-hidden rounded-lg border border-border bg-card shadow-usiu"
                  >
                    <div className="flex h-40 items-center justify-center bg-primary">
                      <BookOpen className="h-14 w-14 text-accent" />
                    </div>
                    <div className="p-6">
                      <h2 className="text-xl font-semibold text-primary">{book.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">By {book.author}</p>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary">
                          {book.category}
                        </span>
                        <span className="text-sm font-semibold text-green-700">
                          {book.copies} {book.copies === 1 ? "Copy" : "Copies"}
                        </span>
                      </div>
                      <button
                        onClick={() => borrowBook(book)}
                        disabled={isBorrowing !== null}
                        className="mt-6 w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-usiu-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBorrowing === book.id ? "Borrowing..." : "Borrow This Book"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {activeTab === "loans" && (
              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-primary text-xs uppercase text-primary-foreground">
                    <tr>
                      <th className="px-5 py-4">Book Title</th>
                      <th className="px-5 py-4">Issue Date</th>
                      <th className="px-5 py-4">Due Date</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id} className="border-t border-border">
                        <td className="px-5 py-4 font-semibold text-primary">
                          {loan.books?.title || "Unknown book"}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(loan.issue_date)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(loan.due_date)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(loan.status)}`}
                          >
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm italic text-muted-foreground">
                          Contact library to return
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "requests" && (
              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="bg-primary text-xs uppercase text-primary-foreground">
                    <tr>
                      <th className="px-5 py-4">Requested Book</th>
                      <th className="px-5 py-4">Author</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id} className="border-t border-border">
                        <td className="px-5 py-4 font-semibold text-primary">{request.title}</td>
                        <td className="px-5 py-4 text-muted-foreground">{request.author || "-"}</td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {formatDate(request.created_at?.slice(0, 10))}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(request.status)}`}
                          >
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "resources" && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {resources.map((resource) => (
                  <article
                    key={resource.id}
                    className="rounded-lg border border-border bg-card p-6 shadow-usiu"
                  >
                    <div className="flex items-start justify-between">
                      <span className="rounded-md bg-muted p-3">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(resource.created_at?.slice(0, 10))}
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
                        <Download className="h-4 w-4" /> Download Guide
                      </a>
                    ) : (
                      <p className="mt-6 text-center text-sm italic text-muted-foreground">
                        No file attached
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}

            {contentIsEmpty && (
              <p className="py-12 text-center text-muted-foreground">No records to display yet.</p>
            )}
          </div>
        )}
      </div>

      {isRequestModalOpen && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-book-title"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl">
            <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
              <h2 id="request-book-title" className="flex items-center gap-3 text-xl font-bold">
                <BookOpen className="h-5 w-5 text-accent" /> Request a Book
              </h2>
              <button
                aria-label="Close request dialog"
                onClick={() => setIsRequestModalOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={submitBookRequest} className="space-y-5 p-6">
              <RequestField
                label="Book Title"
                value={requestForm.title}
                onChange={(value) => setRequestForm({ ...requestForm, title: value })}
                placeholder="Enter book title"
                required
              />
              <RequestField
                label="Author (Optional)"
                value={requestForm.author}
                onChange={(value) => setRequestForm({ ...requestForm, author: value })}
                placeholder="Enter author name"
              />
              <label className="block text-sm font-semibold text-muted-foreground">
                Reason for Request
                <textarea
                  value={requestForm.reason}
                  onChange={(event) =>
                    setRequestForm({ ...requestForm, reason: event.target.value })
                  }
                  placeholder="Why should the library acquire this book?"
                  rows={4}
                  className="mt-2 w-full resize-y rounded-md border border-border px-4 py-3 font-normal text-foreground outline-none focus:border-accent"
                />
              </label>
              <button
                disabled={isRequesting}
                className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-usiu-dark-blue disabled:opacity-60"
              >
                {isRequesting ? "Submitting..." : "Submit Acquisition Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const RequestField = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) => (
  <label className="block text-sm font-semibold text-muted-foreground">
    {label}
    <input
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 h-14 w-full rounded-md border border-border px-4 font-normal text-foreground outline-none focus:border-accent"
    />
  </label>
);

export default LibraryPage;
