// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/roles";

export const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as AppRole) ?? null;
};

export const fetchUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, student_id, avatar_url, course, year_of_study, email, phone")
    .eq("id", userId)
    .maybeSingle();
  return data;
};

export const signUpUser = async (
  email: string,
  password: string,
  metadata: { full_name: string; student_id?: string; phone?: string }
) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        full_name: metadata.full_name,
        student_id: metadata.student_id,
        phone: metadata.phone
      },
      emailRedirectTo: window.location.origin,
    },
  });

  if (!error) {
    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      await supabase.from("profiles").update({
        student_id: metadata.student_id || null,
        phone: metadata.phone || null,
        full_name: metadata.full_name,
      }).eq("id", newUser.id);
    }
  }

  return { error: error as Error | null };
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  return { error };
};

export const signInUser = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
};

export const signOutUser = async () => {
  await supabase.auth.signOut();
};
