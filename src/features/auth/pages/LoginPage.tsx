import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { fetchUserRole } from "@/services/auth";
import { getRoleDashboardPath } from "@/types/roles";
import { supabase } from "@/integrations/supabase/client";

const LoginPage = () => {
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(studentId, studentPassword);

    if (error) {
      setIsLoading(false);
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = await fetchUserRole(user.id);
        if (role === "student" || role === "superadmin") {
          setIsLoading(false);
          navigate("/dashboard");
        } else {
          setIsLoading(false);
          navigate(getRoleDashboardPath(role));
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-usiu-dark-blue flex items-center justify-center">
      <div className="w-full max-w-[500px] p-8">
        <div className="bg-card rounded-xl overflow-hidden shadow-usiu-card">
          <div className="bg-primary text-center p-8 border-b border-border">
            <h1 className="text-[2rem] font-bold text-accent mb-1">OmniCampus</h1>
            <p className="text-primary-foreground/90">Welcome back! Please login to your student account</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleStudentLogin}>
              <div className="mb-6">
                <label className="block mb-2 text-muted-foreground text-sm font-medium">Student ID / Email</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID or email"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-muted-foreground text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground py-4 rounded-md font-medium text-base hover:bg-usiu-dark-blue transition-colors duration-300 disabled:opacity-50"
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
            <div className="text-center mt-6 pt-6 border-t border-border text-muted-foreground">
              <p>
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-medium">
                  Register here
                </Link>
              </p>
              <p className="mt-4 text-sm">
                Are you an administrator?{" "}
                <Link to="/admin/login" className="text-primary font-medium">
                  Admin Login
                </Link>
              </p>
            </div>
          </div>

          <div className="text-center p-6 border-t border-border text-muted-foreground">
            <Link to="/" className="text-primary font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
