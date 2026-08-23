import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { updateUserPassword } from "@/services/auth";
import { toast } from "@/hooks/use-toast";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setIsCheckingSession(false);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmation) {
      toast({ title: "Passwords do not match", description: "Enter the same password twice.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await updateUserPassword(password);
    setIsLoading(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Password updated", description: "You can now log in with your new password." });
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-usiu-dark-blue flex items-center justify-center">
      <div className="w-full max-w-[500px] p-8">
        <div className="bg-card rounded-xl overflow-hidden shadow-usiu-card">
          <div className="bg-primary text-center p-8 border-b border-border">
            <h1 className="text-[2rem] font-bold text-accent mb-1">Choose a new password</h1>
            <p className="text-primary-foreground/90">Your new password will protect your OmniCampus account.</p>
          </div>

          <div className="p-8">
            {isCheckingSession ? (
              <p className="text-center text-muted-foreground">Checking recovery link...</p>
            ) : !hasSession ? (
              <div className="space-y-6 text-center">
                <p className="text-muted-foreground">This recovery link is invalid or has expired.</p>
                <Link to="/forgot-password" className="text-primary font-medium hover:underline">Request a new link</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block mb-2 text-muted-foreground text-sm font-medium">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-muted-foreground text-sm font-medium">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-md font-medium text-base hover:bg-usiu-dark-blue transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Updating..." : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
