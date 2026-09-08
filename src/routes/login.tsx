import React, { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { ShieldCheck, Radar, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, route to home which decides between onboarding & dashboard
  React.useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

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
        toast.success("Welcome back!");
        navigate({ to: "/" });
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
        navigate({ to: "/onboarding" });
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
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Subtle Radar Circles */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute -bottom-48 -left-48 w-[32rem] h-[32rem] rounded-full border border-white/5 pointer-events-none" />

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground font-mono font-bold text-lg shadow-sm">
            BR
          </div>
          <span className="font-display font-bold tracking-tight text-xl text-white">
            GetBid<span className="text-accent">Radar</span>
          </span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono uppercase tracking-wider text-accent">
            <Radar className="h-3.5 w-3.5 animate-spin" /> Deterministic Bid Intelligence
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white leading-tight">
            Stop guessing on complex tenders. Bid with certainty.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed text-gray-300">
            Extract mandatory RFP requirements in seconds, match against corporate qualifications,
            and receive explainable BID / REVIEW / NO-BID decisions backed by verified evidence.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs text-gray-300 font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Zero Hallucination
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Strict Tenant Isolation
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400 font-mono">
          Enterprise Tender Intelligence Engine v2.0
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
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
