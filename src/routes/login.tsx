import React, { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { getSafeRedirect, resolveAuthDestination } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Radar, AlertCircle, ArrowRight, Loader2, ChevronLeft, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/bidradar.png";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const { workspace, isOnboarded, isLoading: wsLoading } = useWorkspace();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const rawRedirect = search.redirect;

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, route to destination or dashboard/onboarding
  React.useEffect(() => {
    if (user && !wsLoading) {
      const destination = resolveAuthDestination({
        hasWorkspace: Boolean(workspace),
        isOnboarded,
        rawRedirect,
      });
      navigate({ to: destination });
    }
  }, [user, wsLoading, workspace, isOnboarded, rawRedirect, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error("Sign in failed", { description: error.message });
      } else if (data.session) {
        // Deterministically check workspace membership for immediate navigation
        const { data: memberRows } = await supabase
          .from("workspace_members")
          .select("workspace_id, workspaces(onboarding_completed_at)")
          .eq("user_id", data.session.user.id)
          .limit(1);

        const hasWs = Boolean(memberRows && memberRows.length > 0);
        const wsObj = memberRows?.[0]?.workspaces as unknown as
          { onboarding_completed_at?: string | null } | undefined;
        const isCompleted = Boolean(wsObj?.onboarding_completed_at);

        const destination = resolveAuthDestination({
          hasWorkspace: hasWs,
          isOnboarded: isCompleted,
          rawRedirect,
        });

        toast.success("Welcome back!");
        navigate({ to: destination });
      }
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error("Account creation failed", { description: error.message });
      } else if (data.session) {
        toast.success("Account created successfully!");
        const safeRedirect = getSafeRedirect(rawRedirect);
        const dest = safeRedirect
          ? `/onboarding?redirect=${encodeURIComponent(safeRedirect)}`
          : "/onboarding";
        navigate({ to: dest });
      } else {
        // Confirmation email required
        toast.info("Account registered! Please check your email for confirmation.");
      }
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left Hero Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#070e1e] via-[#0b172e] to-[#132247] text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle background glow rings */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full border border-white/5 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} width={150} height={118} alt="GetBidRadar" className="brightness-110" />
          </Link>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 border border-white/10 px-2.5 py-1 rounded-full bg-white/5">
            Enterprise v2.0
          </span>
        </div>

        {/* Core Value & Capabilities */}
        <div className="relative z-10 max-w-lg space-y-7 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/20 px-3 py-1 text-xs font-mono tracking-wider text-blue-300 shadow-sm">
            <Radar className="h-3.5 w-3.5 animate-spin text-blue-400" />
            <span>Deterministic Tender Qualification Platform</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Stop guessing on complex tenders. Pursue with mathematical certainty.
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              Transform unstructured RFP documents into verified requirement matrices, matched evidence,
              and defensible pursuit decisions in minutes.
            </p>
          </div>

          {/* Three Product Pillars */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-display">Automated Requirement Extraction</h2>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  Instant breakdown of mandatory criteria, deadlines, evaluation weights, and technical specifications.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-display">Defensible BID / REVIEW / NO-BID</h2>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  100% deterministic decision engine backed by verified corporate capabilities and historical performance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-display">Complete Bid Command Center</h2>
                <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                  Proposal workspace, AI compliance auditor, submission audit trails, and post-award outcome intelligence.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Zero AI Hallucination</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span>Strict Tenant Isolation</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>GetBidRadar Enterprise</span>
          <span>SOC-2 Ready Architecture</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Back to Homepage / Cancel Navigation */}
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ChevronLeft className="h-4 w-4" /> Back to Homepage
            </Link>
            {rawRedirect && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                Protected Route
              </span>
            )}
          </div>

          {/* Mobile Brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm">
              BR
            </div>
            <span className="font-display font-bold text-lg">
              GetBid<span className="text-accent">Radar</span>
            </span>
          </div>

          <Card className="border border-border/80 shadow-panel bg-card">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")}>
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2 bg-secondary/80">
                  <TabsTrigger value="signin" className="font-medium text-xs">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="font-medium text-xs">
                    Create Account
                  </TabsTrigger>
                </TabsList>
                <div className="pt-4">
                  <CardTitle className="font-display text-xl">
                    {activeTab === "signin" ? "Welcome back" : "Get started with GetBidRadar"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {activeTab === "signin"
                      ? "Enter your credentials to access your workspace"
                      : "Create your organization account and unlock tender intelligence"}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <TabsContent value="signin" className="m-0 space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className="text-xs">
                        Work Email
                      </Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="procurement@company.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-xs">
                          Password
                        </Label>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <Input
                        id="signin-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-10 mt-2 font-medium"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing In...
                        </>
                      ) : (
                        <>
                          Sign In <ArrowRight className="h-4 w-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="m-0 space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs">
                        Full Name
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Alex Vance"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-company" className="text-xs">
                        Company Name
                      </Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="Apex Engineering Solutions"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs">
                        Work Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="alex@apexeng.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs">
                        Password
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimum 8 characters"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-10 mt-2 font-medium"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...
                        </>
                      ) : (
                        <>
                          Create Account <ArrowRight className="h-4 w-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>

              <CardFooter className="pt-2 text-center flex justify-center border-t border-border/40">
                <p className="text-[11px] text-muted-foreground">
                  By continuing, you agree to our enterprise security and service policies.
                </p>
              </CardFooter>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
