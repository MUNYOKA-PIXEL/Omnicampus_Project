import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/services/auth";
import { toast } from "@/hooks/use-toast";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    const { error } = await requestPasswordReset(email.trim());
    setIsLoading(false);

    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-usiu-dark-blue flex items-center justify-center">
      <div className="w-full max-w-[500px] p-8">
        <div className="bg-card rounded-xl overflow-hidden shadow-usiu-card">
          <div className="bg-primary text-center p-8 border-b border-border">
            <h1 className="text-[2rem] font-bold text-accent mb-1">Reset your password</h1>
            <p className="text-primary-foreground/90">We will send a secure recovery link to your email.</p>
          </div>

          <div className="p-8">
            {sent ? (
              <div className="space-y-6 text-center">
                <p className="text-muted-foreground">If an account exists for that email, a password reset link has been sent.</p>
                <Link to="/login" className="inline-block text-primary font-medium hover:underline">Return to login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block mb-2 text-muted-foreground text-sm font-medium">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-md font-medium text-base hover:bg-usiu-dark-blue transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </button>
                <div className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary font-medium hover:underline">Back to login</Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
