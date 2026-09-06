// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/roles";

export const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("role");
  const roles = (data ?? []).map((row) => row.role as AppRole);
  const priority: AppRole[] = ["superadmin", "libadmin", "medadmin", "clubadmin", "student"];
  return priority.find((candidate) => roles.includes(candidate)) ?? null;
};

export const fetchUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select(
      "full_name, student_id, avatar_url, course, academic_level, year_of_study, email, phone",
    )
    .eq("id", userId)
    .maybeSingle();
  return data;
};

export const signUpUser = async (
  email: string,
  password: string,
  metadata: {
    full_name: string;
    student_id?: string;
    phone?: string;
    academic_level?: string;
    course?: string;
    year_of_study?: number;
  },
) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: metadata.full_name,
        student_id: metadata.student_id,
        phone: metadata.phone,
        academic_level: metadata.academic_level,
        course: metadata.course,
        year_of_study: metadata.year_of_study,
      },
      emailRedirectTo: window.location.origin,
    },
  });

  if (!error) {
    const {
      data: { user: newUser },
    } = await supabase.auth.getUser();
    if (newUser) {
      await supabase
        .from("profiles")
        .update({
          student_id: metadata.student_id || null,
          phone: metadata.phone || null,
          full_name: metadata.full_name,
          academic_level: metadata.academic_level || null,
          course: metadata.course || null,
          year_of_study: metadata.year_of_study || null,
        })
        .eq("id", newUser.id);
    }
  }

  return { error: error as Error | null };
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  return { error };
};

export const signInUser = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
};

export const signOutUser = async () => {
  await supabase.auth.signOut();
};

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error: error as Error | null };
};

export const updateUserPassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error as Error | null };
};
