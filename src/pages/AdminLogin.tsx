// @ts-nocheck
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { fetchUserRole } from "@/services/auth";
import { getRoleDashboardPath, isAdminRole } from "@/types/roles";
import { supabase } from "@/integrations/supabase/client";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const adminAccounts = [
    { role: "Super Admin", email: "superadmin@omnicampus.com", pass: "OmniSuper@2026!" },
    { role: "Library Admin", email: "libadmin@omnicampus.com", pass: "LibManage#2026" },
    { role: "Medical Admin", email: "medadmin@omnicampus.com", pass: "MedSecure*2026" },
    { role: "Club Admin", email: "clubadmin@omnicampus.com", pass: "ClubConnect$2026" },
  ];

  const fillCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setIsLoading(false);
      toast({ 
        title: "Login Failed", 
        description: "Invalid credentials. Please check your admin details.", 
        variant: "destructive" 
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = await fetchUserRole(user.id);
      setIsLoading(false);
      
      if (isAdminRole(role)) {
        toast({ title: "Login Successful", description: `Welcome back, Admin!` });
        navigate(getRoleDashboardPath(role));
      } else {
        await supabase.auth.signOut();
        toast({ 
          title: "Access Denied", 
          description: "This page is for administrators only.", 
          variant: "destructive" 
        });
      }
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-usiu-dark-blue flex items-center justify-center p-4">
      <div className="w-full max-w-[500px]">
        <div className="bg-card rounded-xl overflow-hidden shadow-usiu-card">
          {/* Header */}
          <div className="bg-primary text-center p-8 border-b border-border">
            <h1 className="text-[2rem] font-bold text-accent mb-1">OmniCampus</h1>
            <h2 className="text-xl text-primary-foreground font-semibold">Staff Portal</h2>
            <p className="text-primary-foreground/70 mt-2 text-sm uppercase tracking-widest">Administrator Login</p>
          </div>

          <div className="p-8">
            {/* Quick Fill Buttons */}
            <div className="mb-8">
              <label className="block mb-3 text-muted-foreground text-xs font-bold uppercase tracking-wider text-center">Select Role to Auto-Fill</label>
              <div className="grid grid-cols-2 gap-2">
                {adminAccounts.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillCredentials(acc.email, acc.pass)}
                    className="py-2 px-3 border border-border rounded-md text-xs font-semibold hover:bg-accent hover:text-primary transition-all text-center"
                  >
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <label className="block mb-2 text-muted-foreground text-sm font-medium">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@omnicampus.com"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block mb-2 text-muted-foreground text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent transition-all duration-300"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground py-4 rounded-md font-bold text-base hover:bg-usiu-dark-blue transition-colors duration-300 disabled:opacity-50 shadow-lg"
              >
                {isLoading ? "Verifying..." : "Sign In"}
              </button>
            </form>
            
            <div className="text-center mt-8 pt-6 border-t border-border text-muted-foreground">
              <p className="text-sm">
                If you are a student, please use the{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Student Login
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center p-6 border-t border-border bg-muted/30">
            <Link to="/" className="text-primary font-medium hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
