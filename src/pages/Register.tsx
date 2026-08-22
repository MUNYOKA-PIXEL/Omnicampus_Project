import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const Register = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentIdVal, setStudentIdVal] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, {
      full_name: `${firstName} ${lastName}`,
      student_id: studentIdVal,
      phone,
    });
    setIsLoading(false);

    if (error) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Account created! Please check your email to verify." });
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-usiu-dark-blue flex items-center justify-center">
      <div className="w-full max-w-[500px] p-8">
        <div className="bg-card rounded-xl overflow-hidden shadow-usiu-card">
          {/* Header */}
          <div className="bg-primary text-center p-8 border-b border-border">
            <h1 className="text-[2rem] font-bold text-accent mb-1">Create Account</h1>
            <p className="text-primary-foreground/90">Join OmniCampus today</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="p-8">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block mb-2 text-muted-foreground text-sm font-medium">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
                />
              </div>
              <div>
                <label className="block mb-2 text-muted-foreground text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  required
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-muted-foreground text-sm font-medium">Student ID</label>
              <input
                type="text"
                value={studentIdVal}
                onChange={(e) => setStudentIdVal(e.target.value)}
                placeholder="Enter your student ID"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-muted-foreground text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-muted-foreground text-sm font-medium">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-muted-foreground text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
              />
              <small className="text-muted-foreground text-xs mt-1">Minimum 6 characters</small>
            </div>

            <div className="mb-6">
              <label className="block mb-2 text-muted-foreground text-sm font-medium">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] transition-all duration-300"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-4 rounded-md font-medium text-base hover:bg-usiu-dark-blue transition-colors duration-300 disabled:opacity-50"
            >
              {isLoading ? "Creating Account..." : "Register"}
            </button>
          </form>

          <div className="text-center p-6 border-t border-border text-muted-foreground">
            <p className="mb-2">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium">
                Login here
              </Link>
            </p>
            <Link to="/" className="text-primary font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
