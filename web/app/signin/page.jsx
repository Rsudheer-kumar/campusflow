"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  Sparkles,
  UserPlus,
  LogIn,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Button } from "@/components/ui";
import { api, setStoredAccessToken, setStoredUser, getStoredUser, prewarmBackend } from "@/lib/api";

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

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" || searchParams.get("tab") === "signup" ? "register" : "signin";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState("STUDENT");
  const [regDepartment, setRegDepartment] = useState("Computer Science");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [existingUser, setExistingUser] = useState(null);

  useEffect(() => {
    try {
      const stored = getStoredUser();
      if (stored) setExistingUser(stored);
    } catch {}
    // Eagerly prewarm backend on signin page mount to minimize cold start wait
    prewarmBackend();
  }, []);

  // Safe browser-compatible demo session activator (no Node Buffer dependency)
  const handleDirectDemoSession = (demo) => {
    try {
      const payloadStr = JSON.stringify(demo.userObj);
      const encoded =
        typeof window !== "undefined" && typeof btoa === "function"
          ? btoa(unescape(encodeURIComponent(payloadStr)))
          : Buffer.from(payloadStr).toString("base64");
      const fakeToken = "cf_demo_jwt_token_" + encoded;
      setStoredAccessToken(fakeToken);
      setStoredUser(demo.userObj);
      router.push("/dashboard");
    } catch (err) {
      console.error("Direct session creation fallback", err);
      setStoredUser(demo.userObj);
      router.push("/dashboard");
    }
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please provide both email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Check if credentials match one of the verified demo accounts
    const matchedDemo = DEMO_ACCOUNTS.find(
      (d) => d.email.toLowerCase() === cleanEmail && d.password === cleanPassword
    );

    // Fast-path for verified demo accounts:
    // If backend is asleep (Render cold start), do not stall the user for 45s.
    // Try the API for up to 3s; if asleep or erroring, immediately activate the demo session!
    if (matchedDemo) {
      try {
        const loginPromise = api.auth.login(cleanEmail, cleanPassword);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("COLD_START_TIMEOUT")), 3000)
        );

        await Promise.race([loginPromise, timeoutPromise]);
        router.push("/dashboard");
        return;
      } catch (err) {
        console.warn("Backend sleeping or cold start during demo sign-in; activating instant session:", err);
        handleDirectDemoSession(matchedDemo);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    // Standard login for registered custom users
    try {
      await api.auth.login(cleanEmail, cleanPassword);
      router.push("/dashboard");
    } catch (err) {
      console.warn("Sign-in error encountered:", err);
      const isColdStart =
        err?.status === 500 || err?.status === 502 || err?.status === 503 || err?.status === 504 || err?.status === 0;

      const message =
        err?.status === 401
          ? "Invalid email or password. Please verify your credentials or select a Demo Account below."
          : isColdStart
          ? "Server is warming up from sleep mode (Render cloud cold start). Please wait a few seconds and try again, or select a Demo Account for instant access."
          : err instanceof Error
          ? err.message
          : "Sign in failed. The server may be warming up. Please try again or select a Demo Account.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
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
          {/* Active session reminder banner if already logged in */}
          {existingUser && (
            <div className="mb-4 p-3 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-between text-xs text-primary-bright">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">
                  Already logged in as <strong>{existingUser.name}</strong> ({existingUser.roles?.[0] || "User"})
                </span>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 font-semibold text-xs text-primary hover:underline ml-2 shrink-0"
              >
                Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {error && (
            <div
              className="mb-5 flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs sm:text-sm text-danger"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
              {/* Quick direct session link if error occurred */}
              <div className="flex items-center gap-2 pt-1 border-t border-danger/20 text-xs">
                <span className="text-muted">Quick Access:</span>
                <button
                  type="button"
                  onClick={() => handleDirectDemoSession(DEMO_ACCOUNTS[0])}
                  className="font-semibold text-primary hover:underline"
                >
                  Continue as Demo Student
                </button>
              </div>
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
                  <div className="relative">
                    <Input
                      label="Password"
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="CampusFlow@2026!"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-[34px] text-muted hover:text-foreground transition-colors p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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

                {/* 1-Tap Demo Account Chips placed below Sign In button */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="text-xs text-muted font-medium">Demo Account:</span>
                  {DEMO_ACCOUNTS.map((demo) => (
                    <button
                      key={demo.role}
                      type="button"
                      title={`Fill ${demo.role} credentials`}
                      onClick={() => {
                        setEmail(demo.email);
                        setPassword(demo.password);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-surface-2/90 hover:bg-surface-2 text-muted hover:text-foreground border border-border/80 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {demo.role}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Input
                  label="Full Name"
                  id="regName"
                  name="regName"
                  type="text"
                  autoComplete="name"
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
                  autoComplete="email"
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
                    autoComplete="organization"
                    placeholder="e.g. Computer Science"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    id="regPassword"
                    name="regPassword"
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder="CampusFlow@2026!"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute right-3 top-[34px] text-muted hover:text-foreground transition-colors p-1"
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
                Register &amp; Sign In to CampusFlow
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Footer copyright */}
      <p className="mt-8 text-center text-xs text-muted/70 z-10">
        &copy; {new Date().getFullYear()} CampusFlow Academic Platform. Enterprise RBAC &amp; MongoDB replication enabled.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050816] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
