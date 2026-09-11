import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { dismissPasswordChangePromptFn } from "@/lib/members/invitation.functions";

export function PasswordNudgeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || checked) return;

    // Check user_metadata first
    if (user.user_metadata?.["must_change_password"]) {
      setOpen(true);
      setChecked(true);
      return;
    }

    // Also check profiles table
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setChecked(true);
        if (data?.must_change_password) {
          setOpen(true);
        }
      });
  }, [user?.id, user?.user_metadata, checked]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsUpdating(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });
      if (updateErr) throw updateErr;

      await dismissPasswordChangePromptFn();
      toast.success("Permanent password saved successfully!");
      setOpen(false);
    } catch (err) {
      toast.error("Failed to update password", { description: (err as Error).message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = async () => {
    try {
      await dismissPasswordChangePromptFn();
      toast.info("You can change your password anytime in Settings > Security.");
    } catch (err) {
      console.warn("Skip error:", err);
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-base font-bold">
            Set Your Permanent Password
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            You are currently signed in with a temporary password. Would you like to create your own permanent password now?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                className="text-xs h-10 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm New Password</Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              minLength={8}
              className="text-xs h-10"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !newPassword}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Save Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
