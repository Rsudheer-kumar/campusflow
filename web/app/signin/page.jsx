"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, Sparkles, UserPlus, LogIn, CheckCircle2, ShieldCheck, KeyRound } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Button, Select } from "@/components/ui";
import { api, setStoredAccessToken, setStoredUser } from "@/lib/api";

const DEMO_ACCOUNTS = [
  {
    role: "Student",
    email: "student@campusflow.edu",
    password: "CampusFlow@2026!",
    desc: "Browse catalogue, check availability & book rooms",
    userObj: {
      id: "66f000000000000000000001",
      name: "Alex Chen",
      email: "student@campusflow.edu",
      roles: ["STUDENT"],
      department: "Computer Science",
      isActive: true,
    },
  },
  {
    role: "Faculty",
    email: "faculty@campusflow.edu",
    password: "CampusFlow@2026!",
    desc: "Department head approvals & priority laboratory access",
    userObj: {
      id: "66f000000000000000000002",
      name: "Dr. Margaret Hamilton",
      email: "faculty@campusflow.edu",
      roles: ["FACULTY", "DEPARTMENT_HEAD"],
      department: "Computer Science",
      isActive: true,
    },
  },
  {
    role: "Admin",
    email: "admin@campusflow.edu",
    password: "CampusFlow@2026!",
    desc: "Facility manager, catalogue governance & system overrides",
    userObj: {
      id: "66f000000000000000000003",
      name: "System Administrator",
      email: "admin@campusflow.edu",
      roles: ["ADMIN", "FACILITY_MANAGER"],
      department: "Campus Facilities",
      isActive: true,
    },
  },
];

export default function SignInPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("signin"); // "signin" | "register"

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("STUDENT");
  const [regDepartment, setRegDepartment] = useState("Computer Science");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.auth.login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid institutional credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demo) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      await api.auth.login(demo.email, demo.password);
      router.push("/dashboard");
    } catch (err) {
      // If backend network glitch or cold start occurs, provide instant offline demo fallback
      console.warn("Backend login failed; offering instant demo session", err);
      setError(`Backend error: ${err.message}. You can retry or click "Direct Demo Session" below.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Instant demo fallback so users are NEVER locked out during backend cold starts
  const handleDirectDemoSession = (demo) => {
    // Generate simulated access token and store user
    const fakeToken = "cf_demo_jwt_token_" + Buffer.from(JSON.stringify(demo.userObj)).toString("base64");
    setStoredAccessToken(fakeToken);
    setStoredUser(demo.userObj);
    router.push("/dashboard");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError("Name, email, and password are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.auth.register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
        department: regDepartment.trim(),
      });
      setSuccessMessage("Account created successfully! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8 relative selection:bg-[#4F8CFF]/30">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_20%] from-primary/10 via-transparent to-transparent pointer-events-none" />

      {/* Back to Home Link */}
      <div className="w-full max-w-lg mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center text-xs sm:text-sm text-muted hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5 transition-transform group-hover:-translate-x-1" />
          Back to CampusFlow Home
        </Link>
      </div>

      {/* Main Authentication Card */}
      <Card className="w-full max-w-lg border border-border bg-[#0B1224]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-10 p-6 sm:p-8">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center shadow-[0_0_20px_rgba(79,140,255,0.2)]">
            <div className="h-4 w-4 bg-primary rounded-sm shadow-[0_0_10px_#4F8CFF]" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {activeTab === "signin" ? "CampusFlow Sign In" : "Create University Account"}
          </CardTitle>
          <CardDescription className="text-sm text-muted mt-2">
            {activeTab === "signin"
              ? "Access institutional academic timetables, laboratories, and resource reservations."
              : "Register a new profile in the MongoDB database with instant system access."}
          </CardDescription>

          {/* Navigation Tabs */}
          <div className="flex rounded-lg bg-surface-2 p-1 mt-6 border border-border/80">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "signin"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "register"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create Account
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {error && (
            <div
              className="mb-5 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs sm:text-sm text-danger"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              className="mb-5 flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3.5 text-xs sm:text-sm text-success"
              role="alert"
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeTab === "signin" ? (
            <div>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Input
                    label="Institutional Email"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="student@campusflow.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Input
                    label="Password"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isLoading}
                  className="w-full mt-2 shadow-[0_0_25px_rgba(79,140,255,0.25)]"
                >
                  Sign In to CampusFlow
                </Button>
              </form>

              {/* Verified Quick Demo Credentials Section */}
              <div className="mt-8 pt-6 border-t border-border/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    1-Click Verified Demo Accounts:
                  </span>
                  <span className="text-[10px] text-muted">Password: CampusFlow@2026!</span>
                </div>

                <div className="space-y-2">
                  {DEMO_ACCOUNTS.map((demo) => (
                    <div
                      key={demo.role}
                      className="p-2.5 rounded-lg border border-border/80 bg-surface-2/60 hover:bg-surface-2 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{demo.role}</span>
                          <span className="text-[11px] text-muted truncate">({demo.email})</span>
                        </div>
                        <p className="text-[10px] text-muted mt-0.5">{demo.desc}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleQuickLogin(demo)}
                          disabled={isLoading}
                          className="text-[11px] h-7 px-2.5"
                        >
                          Sign In
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Bypasses cloud network in case backend is waking up"
                          onClick={() => handleDirectDemoSession(demo)}
                          className="text-[10px] h-7 px-2 text-muted hover:text-white"
                        >
                          Offline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Input
                  label="Full Name"
                  id="regName"
                  name="regName"
                  type="text"
                  required
                  placeholder="e.g. Jordan Smith"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Input
                  label="Institutional Email"
                  id="regEmail"
                  name="regEmail"
                  type="email"
                  required
                  placeholder="jordan.smith@campusflow.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Primary Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    disabled={isLoading}
                    className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-border bg-surface-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="FACULTY">Faculty</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Department"
                    id="regDepartment"
                    name="regDepartment"
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <Input
                  label="Password"
                  id="regPassword"
                  name="regPassword"
                  type="password"
                  required
                  placeholder="CampusFlow@2026!"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-[10px] text-muted mt-1">
                  Must be at least 8 characters and include uppercase, lowercase, number, and special character.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full mt-3 shadow-[0_0_25px_rgba(79,140,255,0.25)]"
              >
                Register & Sign In to CampusFlow
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Footer copyright */}
      <p className="mt-8 text-center text-xs text-muted/70 z-10">
        &copy; {new Date().getFullYear()} CampusFlow Academic Platform. Enterprise RBAC & MongoDB replication enabled.
      </p>
    </div>
  );
}
