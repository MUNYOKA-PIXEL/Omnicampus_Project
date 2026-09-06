// @ts-nocheck
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/roles";
import {
  fetchUserRole,
  fetchUserProfile,
  signUpUser,
  signInUser,
  signOutUser,
} from "@/services/auth";

interface UserProfile {
  academic_level: string | null;
  full_name: string | null;
  student_id: string | null;
  avatar_url: string | null;
  course: string | null;
  year_of_study: number | null;
  email: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
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
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const [userRole, userProfile] = await Promise.all([
      fetchUserRole(userId),
      fetchUserProfile(userId),
    ]);
    return { userRole, userProfile };
  };

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error("User not found") };
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (!error) {
      await refreshProfile();
    }
    return { error: error as Error | null };
  };

  useEffect(() => {
    let active = true;
    let loadGeneration = 0;

    const applySession = async (newSession: Session | null) => {
      const generation = ++loadGeneration;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(true);

      if (!newSession?.user) {
        if (active && generation === loadGeneration) {
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { userRole, userProfile } = await loadUserData(newSession.user.id);
      if (active && generation === loadGeneration) {
        setRole(userRole);
        setProfile(userProfile);
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void applySession(existingSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        loading,
        signUp: signUpUser,
        signIn: signInUser,
        signOut: handleSignOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
