import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import logo from "@/assets/bidradar.png";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "";

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        redirectTo ? { redirectTo } : {}
      );

      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsSubmitted(true);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "An unexpected error occurred. Please try again.");
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
                {isSubmitted ? "Check your email" : "Reset your password"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {isSubmitted
                  ? "We've sent a recovery link to your inbox."
                  : "Enter your registered email address and we will send you a secure link to reset your password."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isSubmitted ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Recovery email dispatched</p>
                      <p className="text-muted-foreground mt-0.5">
                        If an account exists for <strong className="text-foreground">{email}</strong>, you will receive password reset instructions. Be sure to check your spam folder.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setIsSubmitted(false)}
                    >
                      Try another email
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-xs">
                      Work Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="reset-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 text-sm pl-9"
                      />
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full h-10 mt-2 font-medium text-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending Link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/50 flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
