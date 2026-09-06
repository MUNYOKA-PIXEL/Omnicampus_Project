import { useEffect, useRef, useState } from "react";
import { BookOpen, Camera, GraduationCap, Mail, Phone, UserRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const academicLevels = ["Undergraduate", "Postgraduate", "Diploma", "Certificate", "Other"];
const years = [1, 2, 3, 4, 5];

const ProfilePage = () => {
  const { user, profile, updateProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    course: "",
    academic_level: "",
    year_of_study: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      course: profile?.course || "",
      academic_level: profile?.academic_level || "",
      year_of_study: profile?.year_of_study ? String(profile.year_of_study) : "",
    });
  }, [profile]);

  useEffect(() => {
    let active = true;
    const resolveAvatar = async () => {
      if (!profile?.avatar_url) {
        setAvatarUrl(null);
        return;
      }
      if (profile.avatar_url.startsWith("http")) {
        setAvatarUrl(profile.avatar_url);
        return;
      }
      const { data } = await supabase.storage
        .from("profile-avatars")
        .createSignedUrl(profile.avatar_url, 3600);
      if (active) setAvatarUrl(data?.signedUrl || null);
    };
    void resolveAvatar();
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await updateProfile({
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() || null,
      course: form.course.trim() || null,
      academic_level: form.academic_level || null,
      year_of_study: form.year_of_study ? Number(form.year_of_study) : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Profile update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile updated", description: "Your personal information has been saved." });
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid image",
        description: "Please choose an image file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Profile images must be 5 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    setUploadingAvatar(true);
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage
      .from("profile-avatars")
      .upload(path, file, { upsert: false });
    if (upload.error) {
      setUploadingAvatar(false);
      toast({ title: "Upload failed", description: upload.error.message, variant: "destructive" });
      return;
    }
    const { error } = await updateProfile({ avatar_url: path });
    setUploadingAvatar(false);
    if (error) {
      toast({ title: "Profile update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile photo updated", description: "Your new photo is now visible." });
  };

  const initials = (profile?.full_name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-bold text-primary sm:text-4xl">My Profile</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </header>

        <div className="mt-10 grid gap-8 xl:grid-cols-[365px_1fr]">
          <section className="rounded-xl border border-border bg-card p-8 text-center shadow-usiu">
            <div className="relative mx-auto h-32 w-32">
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-accent bg-muted text-4xl font-bold text-primary">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <button
                aria-label="Change profile photo"
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 rounded-full bg-accent p-3 text-primary shadow-md"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
              />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-primary">
              {profile?.full_name || "Your name"}
            </h2>
            <p className="mt-1 text-muted-foreground">{profile?.email || user?.email || ""}</p>
            {profile?.student_id && (
              <span className="mt-4 inline-block rounded-full bg-accent/20 px-4 py-2 text-sm font-semibold text-primary">
                {profile.student_id}
              </span>
            )}
            <div className="mt-7 border-t border-border pt-6 text-left text-sm text-muted-foreground">
              <p className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                {profile?.course || "No Course Set"}
              </p>
              <p className="mt-4 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                {profile?.year_of_study ? `Year ${profile.year_of_study}` : "Year N/A"}
              </p>
              <p className="mt-4 flex items-center gap-3">
                <span className="h-5 w-5 text-center font-bold text-primary">•</span>
                {profile?.academic_level || "Academic level not set"}
              </p>
            </div>
          </section>

          <form
            onSubmit={saveProfile}
            className="rounded-xl border border-border bg-card p-8 shadow-usiu"
          >
            <h2 className="text-xl font-bold text-primary">Personal Information</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Field
                icon={UserRound}
                label="Full Name"
                value={form.full_name}
                onChange={(value) => setField("full_name", value)}
              />
              <Field
                label="Student ID"
                value={profile?.student_id || "Not set"}
                onChange={() => undefined}
                disabled
              />
              <Field
                icon={Mail}
                label="Email Address"
                value={profile?.email || user?.email || ""}
                onChange={() => undefined}
                disabled
                hint="Email cannot be changed"
              />
              <Field
                icon={Phone}
                label="Phone Number"
                value={form.phone}
                onChange={(value) => setField("phone", value)}
              />
              <Field
                icon={GraduationCap}
                label="Course / Major"
                value={form.course}
                placeholder="e.g. Computer Science"
                onChange={(value) => setField("course", value)}
              />
              <SelectField
                label="Academic Level"
                value={form.academic_level}
                options={academicLevels}
                placeholder="Select level"
                onChange={(value) => setField("academic_level", value)}
              />
              <SelectField
                label="Year of Study"
                value={form.year_of_study}
                options={years.map(String)}
                placeholder="Select year"
                onChange={(value) => setField("year_of_study", value)}
              />
            </div>
            <button
              disabled={saving}
              className="mt-8 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

const Field = ({ icon: Icon, label, value, onChange, hint, ...props }: any) => (
  <label className="block text-sm font-semibold text-muted-foreground">
    {label}
    <div className="relative mt-2">
      {Icon && (
        <Icon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      )}
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-14 w-full rounded-md border border-border bg-background px-4 text-base font-normal text-foreground outline-none focus:border-accent ${Icon ? "pl-12" : ""} disabled:bg-muted disabled:text-muted-foreground`}
      />
    </div>
    {hint && <span className="mt-1 block text-xs font-normal">{hint}</span>}
  </label>
);
const SelectField = ({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <label className="block text-sm font-semibold text-muted-foreground">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-14 w-full rounded-md border border-border bg-background px-4 text-base font-normal text-foreground outline-none focus:border-accent"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "5" ? "Year 5+" : option}
        </option>
      ))}
    </select>
  </label>
);

export default ProfilePage;
