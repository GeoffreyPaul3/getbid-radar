import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/bidradar.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Listen for auth state changes (e.g. PASSWORD_RECOVERY event)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasValidSession(true);
          setIsVerifyingSession(false);
        }
      }
    );

    // Also check current session
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (session) {
          setHasValidSession(true);
        } else {
          // Check if hash has access_token or recovery tokens
          const hash = window.location.hash;
          if (hash && (hash.includes("access_token") || hash.includes("type=recovery"))) {
            setHasValidSession(true);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        if (isMounted) {
          setIsVerifyingSession(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error("Failed to update password", { description: error.message });
      } else {
        setIsSuccess(true);
        toast.success("Password updated successfully");
        setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 2000);
      }
    } catch (err) {
      const msg = (err as Error).message || "Failed to update password.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Link to="/" className="inline-block transition-opacity hover:opacity-90">
              <img src={logo} width={140} height={40} alt="BidRadar" className="h-10 w-auto object-contain" />
            </Link>
          </div>

          <Card className="border border-border/80 shadow-panel bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="font-display text-xl font-bold">
                {isSuccess ? "Password updated" : "Set new password"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {isSuccess
                  ? "Your password has been changed. Redirecting to your dashboard..."
                  : "Choose a strong password with at least 8 characters."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isVerifyingSession ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Verifying recovery link...</span>
                </div>
              ) : !hasValidSession && !isSuccess ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invalid or expired recovery link</p>
                      <p className="text-muted-foreground mt-1">
                        The reset link may have expired or was already used. Please request a fresh password reset email.
                      </p>
                    </div>
                  </div>

                  <Button asChild className="w-full h-10 text-xs">
                    <Link to="/forgot-password">Request new reset link</Link>
                  </Button>
                </div>
              ) : isSuccess ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Success!</p>
                      <p className="text-muted-foreground mt-0.5">
                        Your account password has been updated. You will be redirected shortly.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="w-full h-10 text-xs font-medium"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMsg && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 text-sm pl-9 pr-9"
                        placeholder="••••••••"
                      />
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-10 text-sm pl-9"
                        placeholder="••••••••"
                      />
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full h-10 mt-2 font-medium text-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating Password...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/50 flex justify-center">
              <Link
                to="/login"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
