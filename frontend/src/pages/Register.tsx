import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ArrowRight,
  User,
  Mail,
  Lock,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "@/components/ThemeToggle";
import {
  cognitoSignInWithGoogle,
  cognitoSignInWithEmail,
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoGetCurrentUser,
} from "@/integrations/aws/auth";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

type AuthStep = "form" | "confirm";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authStep, setAuthStep] = useState<AuthStep>("form");
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  // Check if user is already logged in (e.g. returning from Google OAuth redirect)
  useEffect(() => {
    const checkAuth = async () => {
      const user = await cognitoGetCurrentUser();
      if (user) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await cognitoSignInWithGoogle();
      // Cognito will redirect to hosted UI → then back to /dashboard
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Google sign-in failed. Please try again.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please fill in email and password.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        // Sign in
        const result = await cognitoSignInWithEmail(email, password);

        if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          // User hasn't confirmed their email yet
          toast({
            title: "Verification needed",
            description: "Please check your email for the verification code.",
          });
          setAuthStep("confirm");
          setIsLogin(false);
        } else if (result.isSignedIn) {
          toast({ title: "Welcome back!", description: "You've signed in successfully." });
          navigate("/dashboard", { replace: true });
        } else {
          // Handle other next steps if needed
          toast({ title: "Welcome back!", description: "You've signed in successfully." });
          navigate("/dashboard", { replace: true });
        }
      } else {
        // Sign up
        if (!name) {
          toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const result = await cognitoSignUp(email, password, name);

        if (result.nextStep?.signUpStep === "CONFIRM_SIGN_UP") {
          toast({
            title: "Verification code sent!",
            description: "Check your email and enter the 6-digit code below.",
          });
          setAuthStep("confirm");
        } else if (result.isSignUpComplete) {
          toast({ title: "Account created!", description: "You can now sign in." });
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      const message = err?.message || "Authentication failed.";

      // If user already exists but not confirmed, show confirm step
      if (message.includes("User already exists") || message.includes("UsernameExistsException")) {
        toast({
          title: "Account exists",
          description: "This email is already registered. Try signing in.",
        });
        setIsLogin(true);
      } else {
        toast({ title: "Error", description: message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!confirmCode || confirmCode.length < 6) {
      toast({ title: "Invalid code", description: "Please enter the 6-digit verification code.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      await cognitoConfirmSignUp(email, confirmCode);
      toast({
        title: "Email verified!",
        description: "Your account is confirmed. Signing you in...",
      });

      // Auto sign-in after confirmation
      try {
        const result = await cognitoSignInWithEmail(email, password);
        if (result.isSignedIn) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        // Auto sign-in failed, ask user to sign in manually
      }

      setAuthStep("form");
      setIsLogin(true);
      toast({ title: "Please sign in", description: "Enter your credentials to continue." });
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err?.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ────────── CONFIRMATION CODE SCREEN ──────────
  if (authStep === "confirm") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Media Findr</span>
          </div>
          <ThemeToggle />
        </nav>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md p-6 sm:p-12">
            <div className="w-full max-w-md space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                  Verify your email
                </h1>
                <p className="mt-2 text-muted-foreground">
                  We've sent a 6-digit code to <strong className="text-foreground">{email}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Verification Code
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    className="h-14 text-center text-2xl font-mono tracking-[0.5em]"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmCode()}
                    autoFocus
                  />
                </div>

                <Button
                  className="w-full h-12 gradient-primary text-primary-foreground font-semibold gap-2"
                  onClick={handleConfirmCode}
                  disabled={loading || confirmCode.length < 6}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Verify & Sign In
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button
                    onClick={() => {
                      setAuthStep("form");
                      setIsLogin(false);
                    }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Try again
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────── MAIN FORM SCREEN ──────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Camera className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">Media Findr</span>
        </div>
        <ThemeToggle />
      </nav>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 sm:p-12">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {isLogin ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {isLogin
                  ? "Sign in to manage your events and find your photos."
                  : "Get started with Media Findr to manage events and find photos effortlessly."}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 gap-3 text-sm font-medium border-border"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
                or
              </span>
            </div>

            <div className="space-y-4">
              {!isLogin && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="name" placeholder="Jane Doe" className="pl-10 h-11" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="company" placeholder="Your Company" className="pl-10 h-11" value={company} onChange={(e) => setCompany(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="jane@example.com" className="pl-10 h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                className="w-full h-12 gradient-primary text-primary-foreground font-semibold gap-2"
                onClick={handleEmailAuth}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLogin ? "Sign In" : "Create Account"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-semibold hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;