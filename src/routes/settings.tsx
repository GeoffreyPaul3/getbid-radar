import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  Shield,
  Sparkles,
  Loader2,
  Save,
  Gauge,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  UserPlus,
  Mail,
  Trash2,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { formatNumberWithCommas, parseFormattedNumber } from "@/lib/profile-utils";
import {
  PLAN_CONFIGS,
  formatBillingAmount,
  type WorkspaceBillingContext,
} from "@/lib/billing/plans";
import { getWorkspaceBillingFn } from "@/lib/billing/billing.functions";
import {
  getWorkspaceMembersFn,
  inviteWorkspaceMemberFn,
  updateMemberRoleFn,
  removeMemberFn,
  revokeInvitationFn,
} from "@/lib/members/members.functions";
import type { WorkspaceMemberRecord, AppRole } from "@/lib/members/members.server";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { workspace, companyProfile, role, completenessScore, refetchWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState("company");
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [employeeCount, setEmployeeCount] = useState<number | "">("");
  const [yearsInOperation, setYearsInOperation] = useState<number | "">("");
  const [minContractValue, setMinContractValue] = useState<number | "">("");
  const [maxContractValue, setMaxContractValue] = useState<number | "">("");
  const [minContractDisplay, setMinContractDisplay] = useState("");
  const [maxContractDisplay, setMaxContractDisplay] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [preferredIndustries, setPreferredIndustries] = useState("");
  const [preferredRegions, setPreferredRegions] = useState("");
  const [description, setDescription] = useState("");

  // Team State
  const [members, setMembers] = useState<WorkspaceMemberRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<AppRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [billingContext, setBillingContext] = useState<WorkspaceBillingContext | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const canManageMembers = role === "owner" || role === "admin";

  const loadMembers = useCallback(async () => {
    if (!workspace) return;
    setLoadingMembers(true);
    try {
      const data = await getWorkspaceMembersFn({ data: { workspaceId: workspace.id } });
      setMembers(data);
    } catch (err) {
      console.error("[Settings] Members load error:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !newMemberEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await inviteWorkspaceMemberFn({
        data: {
          workspaceId: workspace.id,
          email: newMemberEmail.trim(),
          fullName: newMemberName.trim(),
          role: newMemberRole,
        },
      });
      toast.success(res.message);
      setAddMemberOpen(false);
      setNewMemberEmail("");
      setNewMemberName("");
      setNewMemberRole("member");
      await loadMembers();
    } catch (err) {
      toast.error("Failed to invite member", { description: (err as Error).message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (targetMemberId: string, newRole: AppRole) => {
    if (!workspace) return;
    try {
      const res = await updateMemberRoleFn({
        data: { workspaceId: workspace.id, targetMemberId, newRole },
      });
      toast.success(res.message);
      await loadMembers();
    } catch (err) {
      toast.error("Failed to update role", { description: (err as Error).message });
    }
  };

  const handleRemoveMember = async (targetMemberId: string) => {
    if (!workspace) return;
    if (!window.confirm("Are you sure you want to remove this member from the workspace?")) return;
    try {
      const res = await removeMemberFn({
        data: { workspaceId: workspace.id, targetMemberId },
      });
      toast.success(res.message);
      await loadMembers();
    } catch (err) {
      toast.error("Failed to remove member", { description: (err as Error).message });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!workspace) return;
    try {
      const res = await revokeInvitationFn({
        data: { workspaceId: workspace.id, invitationId },
      });
      toast.success(res.message);
      await loadMembers();
    } catch (err) {
      toast.error("Failed to revoke invitation", { description: (err as Error).message });
    }
  };

  useEffect(() => {
    async function loadBilling() {
      if (!workspace) return;
      setLoadingBilling(true);
      try {
        const data = await getWorkspaceBillingFn({ data: { workspaceId: workspace.id } });
        setBillingContext(data);
      } catch (err) {
        console.error("[Settings] Billing load error:", err);
      } finally {
        setLoadingBilling(false);
      }
    }

    loadBilling();
  }, [workspace]);

  const parseArrayInput = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    setIsSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          legal_name: legalName.trim() || null,
          industry: industry.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          employee_count: employeeCount === "" ? null : Number(employeeCount),
          years_in_operation: yearsInOperation === "" ? null : Number(yearsInOperation),
          min_contract_value: minContractValue === "" ? null : Number(minContractValue),
          max_contract_value: maxContractValue === "" ? null : Number(maxContractValue),
          currency: currency.trim() || "USD",
          preferred_industries: parseArrayInput(preferredIndustries),
          preferred_regions: parseArrayInput(preferredRegions),
          description: description.trim() || null,
        })
        .eq("workspace_id", workspace.id);

      if (pErr) throw pErr;

      // Sync workspace name with company name if changed
      if (companyName.trim() && companyName.trim() !== workspace.name) {
        await supabase
          .from("workspaces")
          .update({ name: companyName.trim() })
          .eq("id", workspace.id);
      }

      await refetchWorkspace();
      toast.success("Company profile calibrated successfully!");
    } catch (err) {
      toast.error("Failed to save changes", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              Workspace Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure company qualification facts, commercial thresholds, and organization access.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-mono">
              <Gauge className="h-3.5 w-3.5 text-accent" />
              <span>Readiness:</span>
              <span className="font-bold text-foreground">{completenessScore}%</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              Role: {role || "member"}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full sm:w-[460px] grid-cols-3 bg-secondary/80">
            <TabsTrigger value="company" className="text-xs font-medium flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Company Profile
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-medium flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs font-medium flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" /> Billing & Plan
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Company Profile Calibration */}
          <TabsContent value="company" className="mt-4 space-y-6">
            <Card className="border border-border/80 shadow-panel bg-card">
              <form onSubmit={handleSaveProfile}>
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    Company Qualification Profile
                  </CardTitle>
                  <CardDescription className="text-xs">
                    These parameters are fed directly into the Phase 2 evidence retriever to compute
                    Capability, Experience, and Commercial Fit scores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-cname" className="text-xs">
                        Company Name *
                      </Label>
                      <Input
                        id="s-cname"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-legal" className="text-xs">
                        Legal Entity Name
                      </Label>
                      <Input
                        id="s-legal"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-ind" className="text-xs">
                        Primary Industry
                      </Label>
                      <Input
                        id="s-ind"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-country" className="text-xs">
                        Country
                      </Label>
                      <Input
                        id="s-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-web" className="text-xs">
                        Website
                      </Label>
                      <Input
                        id="s-web"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-emp" className="text-xs">
                        Employee Count
                      </Label>
                      <Input
                        id="s-emp"
                        type="number"
                        value={employeeCount}
                        onChange={(e) =>
                          setEmployeeCount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-years" className="text-xs">
                        Years in Operation
                      </Label>
                      <Input
                        id="s-years"
                        type="number"
                        value={yearsInOperation}
                        onChange={(e) =>
                          setYearsInOperation(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/40">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-curr" className="text-xs">
                        Base Currency
                      </Label>
                      <Input
                        id="s-curr"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-min" className="text-xs">
                        Min Contract Value
                      </Label>
                      <Input
                        id="s-min"
                        type="text"
                        inputMode="numeric"
                        value={minContractDisplay}
                        placeholder="e.g. 50,000"
                        onChange={(e) => {
                          const formatted = formatNumberWithCommas(e.target.value);
                          setMinContractDisplay(formatted);
                          setMinContractValue(parseFormattedNumber(formatted));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-max" className="text-xs">
                        Max Contract Value
                      </Label>
                      <Input
                        id="s-max"
                        type="text"
                        inputMode="numeric"
                        value={maxContractDisplay}
                        placeholder="e.g. 5,000,000"
                        onChange={(e) => {
                          const formatted = formatNumberWithCommas(e.target.value);
                          setMaxContractDisplay(formatted);
                          setMaxContractValue(parseFormattedNumber(formatted));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-pind" className="text-xs">
                        Preferred Industries (comma-separated)
                      </Label>
                      <Input
                        id="s-pind"
                        value={preferredIndustries}
                        onChange={(e) => setPreferredIndustries(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-preg" className="text-xs">
                        Preferred Regions (comma-separated)
                      </Label>
                      <Input
                        id="s-preg"
                        value={preferredRegions}
                        onChange={(e) => setPreferredRegions(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label htmlFor="s-desc" className="text-xs">
                      Corporate Capability Statement & Scope
                    </Label>
                    <Textarea
                      id="s-desc"
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                </CardContent>
                <div className="flex justify-end p-6 pt-0">
                  <Button type="submit" disabled={isSaving} className="font-medium">
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>

          {/* TAB 2: Team & Workspace Information */}
          <TabsContent value="team" className="mt-4 space-y-6">
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">
                  Workspace Subscription & Plan
                </CardTitle>
                <CardDescription className="text-xs">
                  Active tenant subscription and authorization tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">
                      Tenant Plan
                    </p>
                    <p className="font-display font-bold text-lg text-foreground mt-0.5 uppercase font-mono">
                      {workspace?.plan || "trial"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Status</p>
                    <p className="font-display font-bold text-lg text-bid mt-0.5 uppercase font-mono">
                      {workspace?.subscription_status || "active"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">Created</p>
                    <p className="font-display font-bold text-lg text-foreground mt-0.5 font-mono">
                      {workspace ? new Date(workspace.created_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workspace Members & Directory */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-accent" /> Workspace Members & Access Control
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Collaborative team access with strict role-based authorization and tenant
                    isolation.
                  </CardDescription>
                </div>
                {canManageMembers && (
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="bg-accent text-accent-foreground font-semibold hover:bg-accent/90 gap-1.5 shadow-sm"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px]">
                      <form onSubmit={handleInviteMember}>
                        <DialogHeader>
                          <DialogTitle className="font-display text-lg flex items-center gap-2">
                            <Mail className="h-5 w-5 text-accent" /> Invite Team Member
                          </DialogTitle>
                          <DialogDescription className="text-xs">
                            Send a secure invitation. New members establish their own credentials
                            upon joining.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="mem-name" className="text-xs">
                              Full Name
                            </Label>
                            <Input
                              id="mem-name"
                              placeholder="e.g. Tendai Chisale"
                              value={newMemberName}
                              onChange={(e) => setNewMemberName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="mem-email" className="text-xs">
                              Business Email
                            </Label>
                            <Input
                              id="mem-email"
                              type="email"
                              placeholder="colleague@organization.com"
                              value={newMemberEmail}
                              onChange={(e) => setNewMemberEmail(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="mem-role" className="text-xs">
                              Workspace Role
                            </Label>
                            <Select
                              value={newMemberRole}
                              onValueChange={(val) => setNewMemberRole(val as AppRole)}
                            >
                              <SelectTrigger id="mem-role" className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  Admin (Full management & invitations)
                                </SelectItem>
                                <SelectItem value="member">
                                  Member (Analyze tenders, edit tasks & proposals)
                                </SelectItem>
                                <SelectItem value="viewer">
                                  Viewer (Read-only intelligence access)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="p-3 rounded-lg border border-border/60 bg-muted/30 text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground">
                              Zero-Trust Credential Setup:
                            </span>{" "}
                            Passwords are never generated or transmitted in plaintext. The invited
                            user will receive a secure onboarding link to establish their own
                            credentials.
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAddMemberOpen(false)}
                            disabled={isInviting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isInviting}
                            className="bg-accent text-accent-foreground font-semibold"
                          >
                            {isInviting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Send Invitation
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {loadingMembers ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No members found in this workspace.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
                    {members.map((m) => {
                      const isSelf = m.userId === user?.id;
                      return (
                        <div
                          key={m.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {m.avatarUrl ? (
                              <img
                                src={m.avatarUrl}
                                alt={m.fullName}
                                className="h-9 w-9 rounded-full object-cover border border-border/60"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-accent/15 text-accent font-mono text-xs font-bold flex items-center justify-center border border-accent/20">
                                {m.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {m.fullName}
                                </p>
                                {isSelf && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 px-1.5 font-mono"
                                  >
                                    You
                                  </Badge>
                                )}
                                {m.isPending && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 font-mono text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  >
                                    Pending Setup
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">
                                {m.email || (m.isPending ? "Pending invitation acceptance" : "—")}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {m.isPending ? "Invited" : "Joined"}{" "}
                                {new Date(m.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {canManageMembers && !isSelf && !m.isPending ? (
                              <Select
                                value={m.role}
                                onValueChange={(val) => handleUpdateRole(m.id, val as AppRole)}
                              >
                                <SelectTrigger className="h-8 text-xs font-mono uppercase w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="owner">Owner</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className="font-mono text-xs uppercase text-accent border-accent/60 px-2.5 py-1"
                              >
                                {m.role}
                              </Badge>
                            )}

                            {canManageMembers && !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  m.isPending
                                    ? handleRevokeInvitation(m.id)
                                    : handleRemoveMember(m.id)
                                }
                                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                title={m.isPending ? "Revoke invitation" : "Remove member"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Centralized AI Intelligence Architecture */}
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-accent" /> Centralized AI Gateway & Engine
                  Architecture
                </CardTitle>
                <CardDescription className="text-xs">
                  Centralized AI gateway topology, model cascade, and deterministic qualification
                  engine.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">
                        Primary Gateway
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      >
                        Active
                      </Badge>
                    </div>
                    <p className="font-display font-bold text-foreground">
                      Google Gemini 2.5 Flash
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      High-speed structured extraction, requirements matrix, and evidence parsing.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">
                        Fallback 1
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      >
                        Standby
                      </Badge>
                    </div>
                    <p className="font-display font-bold text-foreground">Groq (Llama 3.3 70B)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Automatic cascade failover on provider timeouts, 429s, or service degradation.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">
                        Fallback 2
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                      >
                        Standby
                      </Badge>
                    </div>
                    <p className="font-display font-bold text-foreground">OpenRouter Gateway</p>
                    <p className="text-[11px] text-muted-foreground">
                      Secondary cascade failover preserving analysis continuity under peak loads.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-accent/5 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Deterministic Scoring Authority
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      AI models extract tender requirements and match evidence. The BID / REVIEW /
                      NO-BID decision is strictly computed by the deterministic scoring engine
                      according to your organizational criteria. AI models cannot override your
                      organization&apos;s human pursuit decision.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Billing & Subscription Intelligence */}
          <TabsContent value="billing" className="mt-4 space-y-6">
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-accent" /> Active Subscription & Commercial
                    Entitlement
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deterministic capacity management and PayChangu commercial billing integration.
                  </CardDescription>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="bg-accent text-accent-foreground font-semibold hover:bg-accent/90 gap-1.5 shadow-sm"
                >
                  <Link to="/billing">
                    Manage Subscription <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-6">
                {loadingBilling ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Active Plan
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold text-foreground">
                            {billingContext?.planConfig?.name ||
                              (workspace?.plan ? workspace.plan.toUpperCase() : "TRIAL")}
                          </span>
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] uppercase ${
                              workspace?.subscription_status === "active"
                                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                            }`}
                          >
                            {workspace?.subscription_status || "trialing"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {billingContext?.planConfig?.tagline || "Enterprise qualification tier"}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Analysis Allowance
                        </span>
                        <div className="font-display text-lg font-bold text-foreground">
                          {billingContext?.analysesAllowance === -1
                            ? "Unlimited"
                            : `${billingContext?.analysesUsed ?? 0} / ${billingContext?.analysesAllowance ?? 3}`}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {billingContext?.analysesAllowance === -1
                            ? "Continuous AI qualification pipeline"
                            : `${billingContext?.remainingAnalyses ?? 0} analyses remaining this period`}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Evaluation / Renewal
                        </span>
                        <div className="font-display text-lg font-bold text-foreground">
                          {workspace?.trial_ends_at
                            ? new Date(workspace.trial_ends_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Monthly Active"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {billingContext?.isTrialExpired
                            ? "Evaluation period ended. Paid upgrade required."
                            : "Server-authoritative billing entitlement"}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          Monthly Capacity Utilization
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {billingContext?.analysesAllowance === -1
                            ? "Unlimited Allocation"
                            : `${Math.round(((billingContext?.analysesUsed ?? 0) / Math.max(1, billingContext?.analysesAllowance ?? 3)) * 100)}% Used`}
                        </span>
                      </div>
                      <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300 rounded-full"
                          style={{
                            width:
                              billingContext?.analysesAllowance === -1
                                ? "100%"
                                : `${Math.min(100, Math.round(((billingContext?.analysesUsed ?? 0) / Math.max(1, billingContext?.analysesAllowance ?? 3)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-foreground">
                          Upgrade or Switch Commercial Plan
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to Growth or Pro Enterprise with instant checkout via PayChangu
                          (MWK / USD).
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        className="bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-sm shrink-0"
                      >
                        <Link to="/billing">View All Plans & Upgrade →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
