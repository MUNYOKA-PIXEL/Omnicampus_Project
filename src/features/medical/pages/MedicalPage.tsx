// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, Download, FileText, History, Pill, Plus, Stethoscope, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Tab = "appointments" | "practitioners" | "pharmacy" | "wellness";
const tabs: { id: Tab; label: string }[] = [
  { id: "appointments", label: "My Appointments" },
  { id: "practitioners", label: "Practitioners" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "wellness", label: "Wellness Library" },
];
const formatDate = (date: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString() : "-";

const MedicalPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("appointments");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [form, setForm] = useState({ date: "", time: "", reason: "" });
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const loadMedicalData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [appointmentsResult, doctorsResult, medicationsResult, resourcesResult] = await Promise.all([
      supabase.from("appointments").select("*, doctors(name, specialty)").eq("user_id", user.id).order("date", { ascending: true }),
      supabase.from("doctors").select("*").order("name"),
      supabase.from("medications").select("*").eq("available", true).order("name"),
      supabase.from("resources").select("*").eq("category", "wellness").order("created_at", { ascending: false }),
    ]);
    setAppointments(appointmentsResult.data || []);
    setDoctors(doctorsResult.data || []);
    setMedications(medicationsResult.data || []);
    setResources(resourcesResult.data || []);
    setIsLoading(false);
  };

  useEffect(() => { loadMedicalData(); }, [user]);
  const upcoming = useMemo(() => appointments.filter((item) => item.date >= today && item.status !== "cancelled"), [appointments, today]);
  const past = useMemo(() => appointments.filter((item) => item.date < today || item.status === "completed"), [appointments, today]);

  const bookAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedDoctor) return;
    setIsSaving(true);
    const { error } = await supabase.from("appointments").insert({ user_id: user.id, doctor_id: selectedDoctor.id, date: form.date, time: form.time, reason: form.reason.trim() || null });
    setIsSaving(false);
    if (error) { toast({ title: "Booking failed", description: error.message, variant: "destructive" }); return; }
    setSelectedDoctor(null); setForm({ date: "", time: "", reason: "" });
    toast({ title: "Appointment requested", description: "Your visit is pending confirmation." });
    await loadMedicalData();
  };

  const cancelAppointment = async (appointment: any) => {
    if (!window.confirm("Cancel this appointment?")) return;
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointment.id).eq("user_id", user.id);
    if (error) { toast({ title: "Cancellation failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Appointment cancelled", description: "The appointment has been cancelled." });
    await loadMedicalData();
  };

  return <DashboardLayout><div className="mx-auto max-w-7xl">
    <header><h1 className="text-3xl font-bold text-primary sm:text-4xl">Medical Services</h1><p className="mt-2 text-muted-foreground">Campus health center and wellness resources</p></header>
    <section className="mt-10 flex flex-col gap-5 rounded-lg border border-red-700 bg-red-600 p-5 text-white shadow-usiu sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-4"><AlertTriangle className="h-10 w-10 shrink-0 text-accent" /><div><h2 className="text-lg font-bold">Medical emergency?</h2><p className="text-sm sm:text-base">Call campus security: <a href="tel:+254700123911" className="font-bold underline">+254 700 123 911</a> or dial 911</p></div></div><a href="tel:+254700123911" className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 font-bold text-red-700 hover:bg-red-50">Call now</a></section>
    <section className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard icon={CalendarCheck} value={upcoming.length} label="Upcoming visits" active /><StatCard icon={History} value={past.length} label="Past visits" /><StatCard icon={Stethoscope} value={doctors.filter((doctor) => doctor.available).length} label="Active doctors" /><StatCard icon={Pill} value={medications.length} label="Pharmacy stock" /></section>
    <div className="mt-10 overflow-x-auto border-b border-primary whitespace-nowrap"><div className="flex min-w-max gap-8">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-1 pb-3 text-sm font-medium ${activeTab === tab.id ? "border-accent text-primary" : "border-transparent text-muted-foreground hover:text-primary"}`}>{tab.label}</button>)}</div></div>
    {isLoading ? <div className="py-20 text-center text-muted-foreground">Loading medical services...</div> : <div className="py-8">
      {activeTab === "appointments" && <div className="space-y-6"><div className="rounded-lg border border-dashed border-primary/30 bg-card p-6 text-center">{upcoming.length === 0 ? <p className="text-muted-foreground">No active appointments found.</p> : <div className="space-y-3 text-left">{upcoming.map((appointment) => <div key={appointment.id} className="flex flex-col justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center"><div><p className="font-semibold text-primary">{appointment.doctors?.name || "Practitioner"} <span className="font-normal text-muted-foreground">({appointment.doctors?.specialty || "General care"})</span></p><p className="mt-1 text-sm text-muted-foreground">{formatDate(appointment.date)} at {appointment.time}</p><p className="mt-1 text-sm text-muted-foreground">{appointment.reason || "No reason provided"}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase text-yellow-800">{appointment.status}</span>{appointment.status === "pending" && <button onClick={() => cancelAppointment(appointment)} className="text-sm font-medium text-red-700 hover:underline">Cancel</button>}</div></div>)}</div>}<button onClick={() => setActiveTab("practitioners")} className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Book new appointment</button></div></div>}
      {activeTab === "practitioners" && <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{doctors.filter((doctor) => doctor.available).map((doctor) => <article key={doctor.id} className="rounded-lg border border-border bg-card p-6 text-center shadow-usiu"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent bg-primary"><Stethoscope className="h-10 w-10 text-accent" /></div><h2 className="mt-5 text-xl font-semibold text-primary">{doctor.name}</h2><p className="text-sm uppercase text-primary">{doctor.specialty}</p><span className="mt-4 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-700">Ready for visit</span><button onClick={() => setSelectedDoctor(doctor)} className="mt-5 w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground">Select doctor</button></article>)}</div>}
      {activeTab === "pharmacy" && <section><h2 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-primary"><Pill className="h-5 w-5 text-accent" /> Medication registry</h2><div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{medications.map((medication) => <article key={medication.id} className="rounded-lg border border-border bg-card p-6 shadow-usiu"><Pill className="h-8 w-8 text-primary" /><h3 className="mt-5 text-xl font-semibold text-primary">{medication.name}</h3><p className="mt-1 text-sm uppercase text-muted-foreground">{medication.type}</p><div className="mt-6 flex items-center justify-between"><span className="text-xl font-bold text-green-700">KES {medication.price}</span><span className="rounded-md bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-700">In stock</span></div></article>)}</div></section>}
      {activeTab === "wellness" && <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{resources.map((resource) => <article key={resource.id} className="rounded-lg border border-border bg-card p-6 shadow-usiu"><span className="inline-flex rounded-md bg-primary p-3"><FileText className="h-6 w-6 text-accent" /></span><h2 className="mt-6 text-xl font-semibold text-primary">{resource.title}</h2>{resource.file_url ? <a href={resource.file_url} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-2 text-sm font-bold uppercase text-primary"><Download className="h-4 w-4" /> Access resource</a> : <p className="mt-6 text-sm italic text-muted-foreground">Draft only</p>}</article>)}</div>}
      {((activeTab === "practitioners" && doctors.filter((doctor) => doctor.available).length === 0) || (activeTab === "pharmacy" && medications.length === 0) || (activeTab === "wellness" && resources.length === 0)) && <p className="py-12 text-center text-muted-foreground">No records to display yet.</p>}
    </div>}
  </div>{selectedDoctor && <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-2xl"><div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground"><h2 className="flex items-center gap-2 text-xl font-bold"><CalendarCheck className="h-5 w-5 text-accent" /> Schedule a visit</h2><button onClick={() => setSelectedDoctor(null)} aria-label="Close booking dialog"><X className="h-6 w-6" /></button></div><form onSubmit={bookAppointment} className="space-y-5 p-6"><label className="block text-sm font-semibold uppercase tracking-wide text-muted-foreground">Select doctor<select value={selectedDoctor.id} onChange={(event) => setSelectedDoctor(doctors.find((doctor) => doctor.id === event.target.value))} className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base font-normal normal-case text-foreground">{doctors.filter((doctor) => doctor.available).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} ({doctor.specialty})</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferred date<input type="date" min={today} required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base font-normal normal-case text-foreground" /></label><label className="block text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preferred time<input type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base font-normal normal-case text-foreground" /></label></div><label className="block text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reason for visit<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Describe your symptoms briefly..." className="mt-2 min-h-32 w-full resize-y rounded-md border border-border px-4 py-3 text-base font-normal normal-case text-foreground" /></label><button disabled={isSaving} className="w-full rounded-md bg-primary py-4 font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">{isSaving ? "Booking..." : "Confirm appointment"}</button></form></div></div>}</DashboardLayout>;
+};
+
+const StatCard = ({ icon: Icon, value, label, active }: any) => <div className={`rounded-lg border bg-card p-5 text-center shadow-usiu ${active ? "border-accent" : "border-border"}`}><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Icon className="h-8 w-8 text-primary" /></div><p className="mt-4 text-3xl font-bold text-primary">{value}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p></div>;
+
+export default MedicalPage;
