import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  lookupInvitationByTokenFn,
  acceptInvitationFn,
  dismissPasswordChangePromptFn,
} from "@/lib/members/invitation.functions";
import type { InvitationDetails } from "@/lib/members/members.types";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  component: JoinWorkspacePage,
});

function JoinWorkspacePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sign-in step
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password update step
  const [isSetPasswordStep, setIsSetPasswordStep] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fetchInvitation = useCallback(async () => {
    if (!token) {
      setError("No invitation token provided. Please check the link in your email.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await lookupInvitationByTokenFn({ data: { token } });
      if (data.isExpired) {
        setError("This invitation link has expired. Please request a new invitation from your workspace administrator.");
        setInvitation(null);
        return;
      }
      if (data.isAccepted) {
        setError("This invitation link has already been used and accepted. Please sign in to your workspace.");
        setInvitation(null);
        return;
      }
      setInvitation(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to verify invitation link.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvitation();
  }, [fetchInvitation]);

  // Handle invitation acceptance when already logged in
  const handleAcceptLoggedIn = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await acceptInvitationFn({ data: { token } });
      toast.success(`Joined ${invitation?.workspaceName || "workspace"} successfully!`);
      // Check if user needs to change password
      if (user?.user_metadata?.["must_change_password"]) {
        setIsSetPasswordStep(true);
      } else {
        navigate({ to: "/tenders" });
      }
    } catch (err) {
      toast.error("Acceptance failed", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle sign-in with temporary password and auto-accept
  const handleSignInAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !password.trim()) {
      toast.error("Please enter your temporary password.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Authenticate with Supabase
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password.trim(),
      });

      if (authErr) {
        throw new Error(
          authErr.message === "Invalid login credentials"
            ? "Invalid password. Please enter the temporary password from your invitation email."
            : authErr.message
        );
      }

      // 2. Accept invitation
      await acceptInvitationFn({ data: { token } });
      toast.success(`Welcome to ${invitation.workspaceName}!`);

      // 3. Check if password change is required / nudged
      const mustChange = Boolean(authData.user?.user_metadata?.["must_change_password"]);
      if (mustChange) {
        setIsSetPasswordStep(true);
      } else {
        navigate({ to: "/tenders" });
      }
    } catch (err) {
      toast.error("Failed to sign in", { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle setting new permanent password
  const handleSavePermanentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (updateErr) throw updateErr;

      await dismissPasswordChangePromptFn();
      toast.success("Permanent password saved!");
      navigate({ to: "/tenders" });
    } catch (err) {
      toast.error("Failed to update password", { description: (err as Error).message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Skip password change
  const handleSkipPasswordChange = async () => {
    try {
      await dismissPasswordChangePromptFn();
      toast.info("You can set your permanent password anytime in Settings.");
    } catch (err) {
      console.warn("Skip error:", err);
    }
    navigate({ to: "/tenders" });
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 text-center mb-8">
        <Link to="/" className="inline-flex items-center gap-2 mb-2 group">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold font-heading text-white tracking-tight">
            GetBidRadar
          </span>
        </Link>
        <p className="text-xs text-slate-400">Enterprise Procurement Intelligence Platform</p>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {loading ? (
          <Card className="border-border/40 bg-[#111827]/90 backdrop-blur-md shadow-2xl text-center py-12">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-slate-300 font-medium">Verifying invitation link...</p>
            </CardContent>
          </Card>
        ) : error || !invitation ? (
          <Card className="border-border/40 bg-[#111827]/90 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg font-bold text-white">
                Invitation Unavailable
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {error || "This invitation link is invalid or has expired."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="text-xs text-slate-400 bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 leading-relaxed">
                Workspace invitation links are single-use and expire after 7 days. If you need access, please request a new invitation from your workspace administrator.
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white text-xs">
                  <Link to="/login">Go to Sign In</Link>
                </Button>
                <Button asChild variant="outline" className="w-full border-slate-700 text-slate-300 text-xs">
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isSetPasswordStep ? (
          /* Step 2: Set Permanent Password (Optional/Skippable) */
          <Card className="border-border/40 bg-[#111827]/90 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg font-bold text-white">
                Create Your Permanent Password
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                For enhanced security, replace your temporary password with a permanent one.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSavePermanentPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      className="bg-slate-900/60 border-slate-700 text-white text-xs h-10 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Confirm New Password</Label>
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    minLength={8}
                    className="bg-slate-900/60 border-slate-700 text-white text-xs h-10"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-semibold h-10"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving Password...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Save Permanent Password
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkipPasswordChange}
                    className="w-full text-slate-400 hover:text-white text-xs"
                  >
                    Skip for now →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Step 1: Review Invitation & Sign In */
          <Card className="border-border/40 bg-[#111827]/90 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg font-bold text-white">
                Join {invitation.workspaceName}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Invited by <strong className="text-slate-200">{invitation.invitedByName}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Invitation Details Summary */}
              <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Workspace:</span>
                  <span className="text-white font-medium">{invitation.workspaceName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Assigned Role:</span>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30">
                    {invitation.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Invitee Email:</span>
                  <span className="font-mono text-slate-300">{invitation.email}</span>
                </div>
              </div>

              {/* State A: User is already logged in */}
              {user ? (
                user.email?.toLowerCase() === invitation.email.toLowerCase() ? (
                  <div className="space-y-4 pt-2">
                    <div className="text-xs text-slate-300 bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary shrink-0" />
                      <span>Signed in as <strong>{user.email}</strong>. Ready to accept!</span>
                    </div>
                    <Button
                      onClick={handleAcceptLoggedIn}
                      disabled={isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-semibold h-10"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Joining Workspace...
                        </>
                      ) : (
                        <>
                          Accept & Open Workspace <ArrowRight className="h-3.5 w-3.5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      You are currently signed in as <strong>{user.email}</strong>, but this invitation was issued to <strong>{invitation.email}</strong>.
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => signOut()}
                      className="w-full border-slate-700 text-slate-200 text-xs"
                    >
                      Sign Out to Switch Accounts
                    </Button>
                  </div>
                )
              ) : (
                /* State B: User needs to sign in with temporary credentials */
                <form onSubmit={handleSignInAndAccept} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Email Address</Label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={invitation.email}
                        disabled
                        className="bg-slate-900/80 border-slate-700 text-slate-400 text-xs h-10 pl-8 cursor-not-allowed"
                      />
                      <Mail className="h-4 w-4 text-slate-500 absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-300">Temporary Password</Label>
                      <span className="text-[10px] text-primary">From invitation email</span>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter temporary password"
                        required
                        className="bg-slate-900/60 border-slate-700 text-white text-xs h-10 pl-8 pr-9"
                      />
                      <Lock className="h-4 w-4 text-slate-400 absolute left-2.5 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-3 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-semibold h-10 shadow-lg shadow-primary/25"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Verifying & Joining...
                      </>
                    ) : (
                      <>
                        Sign In & Access Workspace <ArrowRight className="h-3.5 w-3.5 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-center text-slate-400">
                    Already have an account with a permanent password? Enter your password above.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="relative z-10 text-center mt-8 text-xs text-slate-500">
        © {new Date().getFullYear()} GetBidRadar. Enterprise procurement intelligence.
      </div>
    </div>
  );
}
