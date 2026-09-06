// @ts-nocheck
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck, FilePlus, History, Pill, Plus, Stethoscope, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Tab = "schedule" | "practitioners" | "pharmacy" | "wellness";
const tabs: { id: Tab; label: string }[] = [
  { id: "schedule", label: "Full Schedule" },
  { id: "practitioners", label: "Practitioners" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "wellness", label: "Wellness Library" },
];
const emptyDoctor = { name: "", specialty: "" };
const emptyMedicine = { name: "", price: "", type: "" };
const emptyResource = { title: "", file_url: "" };
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString();

const MedicalAdminPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("schedule");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "pending" | "completed">("all");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"doctor" | "medicine" | "resource" | null>(null);
  const [doctorForm, setDoctorForm] = useState(emptyDoctor);
  const [medicineForm, setMedicineForm] = useState(emptyMedicine);
  const [resourceForm, setResourceForm] = useState(emptyResource);

  const loadData = async () => {
    setLoading(true);
    const [appointmentsResult, doctorsResult, medicationsResult, resourcesResult, profilesResult] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("*, doctors(name, specialty)")
          .order("date")
          .order("time"),
        supabase.from("doctors").select("*").order("name"),
        supabase.from("medications").select("*").order("name"),
        supabase
          .from("resources")
          .select("*")
          .eq("category", "wellness")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, student_id"),
      ]);
    setAppointments(appointmentsResult.data || []);
    setDoctors(doctorsResult.data || []);
    setMedications(medicationsResult.data || []);
    setResources(resourcesResult.data || []);
    setProfiles(
      Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile])),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const pending = appointments.filter((appointment) => appointment.status === "pending");
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const displayedAppointments = appointments.filter(
    (appointment) => scheduleFilter === "all" || appointment.status === scheduleFilter,
  );
  const showSchedule = (filter: "pending" | "completed") => {
    setScheduleFilter(filter);
    setTab("schedule");
  };
  const closeModal = () => setModal(null);

  const updateAppointment = async (appointment: any, status: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointment.id);
    if (error) {
      toast({
        title: "Appointment update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Appointment updated", description: `Appointment marked ${status}.` });
    await loadData();
  };
  const saveDoctor = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("doctors").insert({ ...doctorForm, available: true });
    if (error) {
      toast({
        title: "Practitioner creation failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    closeModal();
    setDoctorForm(emptyDoctor);
    toast({
      title: "Practitioner added",
      description: "The practitioner is ready for student bookings.",
    });
    await loadData();
  };
  const saveMedicine = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await supabase
      .from("medications")
      .insert({ ...medicineForm, available: true });
    if (error) {
      toast({ title: "Medicine save failed", description: error.message, variant: "destructive" });
      return;
    }
    closeModal();
    setMedicineForm(emptyMedicine);
    toast({ title: "Medicine added", description: "The medicine is now in pharmacy stock." });
    await loadData();
  };
  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const { error } = await supabase
      .from("resources")
      .insert({ ...resourceForm, uploaded_by: user.id, category: "wellness" });
    if (error) {
      toast({
        title: "Guide publishing failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    closeModal();
    setResourceForm(emptyResource);
    toast({ title: "Guide published", description: "The wellness guide is visible to students." });
    await loadData();
  };
  const remove = async (
    table: "doctors" | "medications" | "resources",
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
            <h1 className="text-3xl font-bold text-primary sm:text-4xl">Medical Admin</h1>
            <p className="mt-2 text-muted-foreground">Manage campus health center records</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setModal("doctor")}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-accent-foreground"
            >
              <Plus className="h-4 w-4" /> Add Practitioner
            </button>
            <button
              onClick={() => setModal("resource")}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              <FilePlus className="h-4 w-4" /> Add Wellness Guide
            </button>
          </div>
        </header>
        <section className="mt-8 flex flex-col gap-5 rounded-xl bg-red-600 px-6 py-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-5">
            <AlertTriangle className="h-11 w-11 shrink-0 text-accent" />
            <div>
              <h2 className="text-xl font-bold">Medical emergency?</h2>
              <p className="mt-1 text-base font-medium">
                Call campus security: {" "}
                <a href="tel:+254700123911" className="font-bold underline underline-offset-2">
                  +254 700 123 911
                </a>{" "}
                or dial 911
              </p>
            </div>
          </div>
          <a
            href="tel:+254700123911"
            className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            Call now
          </a>
        </section>
        <section className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <AdminStat
            icon={CalendarCheck}
            value={pending.length}
            label="Total pending"
            active={tab === "schedule" && scheduleFilter === "pending"}
            onClick={() => showSchedule("pending")}
          />
          <AdminStat
            icon={History}
            value={completed.length}
            label="Cases completed"
            active={tab === "schedule" && scheduleFilter === "completed"}
            onClick={() => showSchedule("completed")}
          />
          <AdminStat
            icon={Stethoscope}
            value={doctors.filter((doctor) => doctor.available).length}
            label="Active doctors"
            active={tab === "practitioners"}
            onClick={() => setTab("practitioners")}
          />
          <AdminStat
            icon={Pill}
            value={medications.filter((medicine) => medicine.available).length}
            label="Pharmacy stock"
            active={tab === "pharmacy"}
            onClick={() => setTab("pharmacy")}
          />
        </section>
        <div className="mt-10 overflow-x-auto border-b border-primary whitespace-nowrap">
          <div className="flex min-w-max gap-8">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  if (item.id === "schedule") setScheduleFilter("all");
                }}
                className={`border-b-2 px-1 pb-3 text-sm font-medium ${tab === item.id ? "border-accent text-primary" : "border-transparent text-muted-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading medical records...</div>
        ) : (
          <div className="py-8">
            {tab === "schedule" && (
              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-usiu">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-primary text-xs uppercase text-primary-foreground">
                    <tr>
                      <th className="px-5 py-4">Student</th>
                      <th className="px-5 py-4">Practitioner</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Reason</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedAppointments.map((appointment) => {
                      const profile = profiles[appointment.user_id];
                      return (
                        <tr key={appointment.id} className="border-t border-border">
                          <td className="px-5 py-4 font-semibold text-primary">
                            {profile?.full_name || "Unknown student"}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {profile?.student_id || "N/A"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {appointment.doctors?.name || "Unknown"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {formatDate(appointment.date)}
                            <span className="block">{appointment.time}</span>
                          </td>
                          <td className="max-w-xs px-5 py-4 text-sm text-muted-foreground">
                            {appointment.reason || "-"}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold uppercase text-yellow-800">
                              {appointment.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              {appointment.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => updateAppointment(appointment, "confirmed")}
                                    className="rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => updateAppointment(appointment, "cancelled")}
                                    className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Decline
                                  </button>
                                </>
                              )}
                              {appointment.status === "confirmed" && (
                                <button
                                  onClick={() => updateAppointment(appointment, "completed")}
                                  className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayedAppointments.length === 0 && (
                  <p className="py-12 text-center text-muted-foreground">
                    No active appointments found.
                  </p>
                )}
              </div>
            )}
            {tab === "practitioners" && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {doctors.map((doctor) => (
                  <article
                    key={doctor.id}
                    className="relative rounded-lg border border-border bg-card p-6 text-center shadow-usiu"
                  >
                    <button
                      aria-label={`Delete ${doctor.name}`}
                      onClick={() => remove("doctors", doctor.id, doctor.name)}
                      className="absolute right-6 top-6 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent bg-primary">
                      <Stethoscope className="h-10 w-10 text-accent" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-primary">{doctor.name}</h2>
                    <p className="text-sm uppercase text-primary">{doctor.specialty}</p>
                    <span
                      className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${doctor.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {doctor.available ? "Ready for visit" : "Unavailable"}
                    </span>
                  </article>
                ))}
              </div>
            )}
            {tab === "pharmacy" && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-primary">
                    <Pill className="h-5 w-5 text-accent" /> Medication registry
                  </h2>
                  <button
                    onClick={() => setModal("medicine")}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    + Add Medicine
                  </button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {medications.map((medicine) => (
                    <article
                      key={medicine.id}
                      className="relative rounded-lg border border-border bg-card p-6 shadow-usiu"
                    >
                      <button
                        aria-label={`Delete ${medicine.name}`}
                        onClick={() => remove("medications", medicine.id, medicine.name)}
                        className="absolute right-6 top-6 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Pill className="h-8 w-8 text-primary" />
                      <h3 className="mt-5 text-xl font-semibold text-primary">{medicine.name}</h3>
                      <p className="mt-1 text-sm uppercase text-muted-foreground">
                        {medicine.type}
                      </p>
                      <div className="mt-6 flex items-center justify-between">
                        <span className="text-xl font-bold text-green-700">
                          KES {medicine.price}
                        </span>
                        <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-700">
                          {medicine.available ? "In stock" : "Out of stock"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {tab === "wellness" && (
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
                    <FilePlus className="h-8 w-8 text-primary" />
                    <h2 className="mt-6 text-xl font-semibold text-primary">{resource.title}</h2>
                    {resource.file_url ? (
                      <a
                        href={resource.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 block font-bold uppercase text-primary underline"
                      >
                        Access resource
                      </a>
                    ) : (
                      <p className="mt-5 text-sm italic text-muted-foreground">Draft only</p>
                    )}
                  </article>
                ))}
                <button
                  onClick={() => setModal("resource")}
                  className="flex min-h-48 items-center justify-center rounded-lg border-2 border-dashed border-primary/30 font-semibold text-primary"
                >
                  <Plus className="mr-2 h-5 w-5" /> Add Wellness Guide
                </button>
              </div>
            )}
          </div>
        )}
        {modal === "doctor" && (
          <Modal title="New Practitioner" onClose={closeModal}>
            <form onSubmit={saveDoctor} className="space-y-5">
              <Field
                label="Full name"
                value={doctorForm.name}
                onChange={(value) => setDoctorForm({ ...doctorForm, name: value })}
                placeholder="Dr. ..."
                required
              />
              <Field
                label="Specialization"
                value={doctorForm.specialty}
                onChange={(value) => setDoctorForm({ ...doctorForm, specialty: value })}
                placeholder="e.g. General Medicine"
                required
              />
              <Submit label="Add to Medical Staff" />
            </form>
          </Modal>
        )}
        {modal === "medicine" && (
          <Modal title="Update Inventory" onClose={closeModal}>
            <form onSubmit={saveMedicine} className="space-y-5">
              <Field
                label="Medication name"
                value={medicineForm.name}
                onChange={(value) => setMedicineForm({ ...medicineForm, name: value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Price (KES)"
                  value={medicineForm.price}
                  onChange={(value) => setMedicineForm({ ...medicineForm, price: value })}
                  placeholder="0"
                  required
                />
                <Field
                  label="Type"
                  value={medicineForm.type}
                  onChange={(value) => setMedicineForm({ ...medicineForm, type: value })}
                  placeholder="e.g. Tablet"
                  required
                />
              </div>
              <Submit label="Save to Pharmacy" />
            </form>
          </Modal>
        )}
        {modal === "resource" && (
          <Modal title="New Wellness Resource" onClose={closeModal}>
            <form onSubmit={saveResource} className="space-y-5">
              <Field
                label="Guide title"
                value={resourceForm.title}
                onChange={(value) => setResourceForm({ ...resourceForm, title: value })}
                placeholder="e.g. Anxiety Management Guide"
                required
              />
              <Field
                label="Resource link"
                type="url"
                value={resourceForm.file_url}
                onChange={(value) => setResourceForm({ ...resourceForm, file_url: value })}
                placeholder="https://..."
              />
              <Submit label="Publish Guide" />
            </form>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
};

const AdminStat = ({ icon: Icon, value, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`rounded-lg border bg-card p-5 text-center shadow-usiu transition hover:-translate-y-0.5 hover:border-accent ${active ? "border-accent" : "border-border"}`}
  >
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <Icon className="h-8 w-8 text-primary" />
    </div>
    <p className="mt-4 text-3xl font-bold text-primary">{value}</p>
    <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
  </button>
);
const Field = ({ label, value, onChange, ...props }: any) => (
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
const Submit = ({ label }: { label: string }) => (
  <button className="w-full rounded-md bg-primary py-4 font-bold text-primary-foreground hover:bg-usiu-dark-blue">
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

export default MedicalAdminPage;
