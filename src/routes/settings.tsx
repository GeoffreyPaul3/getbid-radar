import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Shield, Sparkles, Loader2, Save, Gauge, CreditCard, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { formatNumberWithCommas, parseFormattedNumber } from "@/lib/profile-utils";
import { PLAN_CONFIGS, formatBillingAmount } from "@/lib/billing/plans";
import { getWorkspaceBillingFn } from "@/lib/billing/billing.functions";

type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
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
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [billingContext, setBillingContext] = useState<any>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  useEffect(() => {
    if (companyProfile) {
      setCompanyName(companyProfile.company_name || "");
      setLegalName(companyProfile.legal_name || "");
      setIndustry(companyProfile.industry || "");
      setCountry(companyProfile.country || "");
      setWebsite(companyProfile.website || "");
      setEmployeeCount(companyProfile.employee_count ?? "");
      setYearsInOperation(companyProfile.years_in_operation ?? "");
      const minVal = companyProfile.min_contract_value != null ? Number(companyProfile.min_contract_value) : "";
      const maxVal = companyProfile.max_contract_value != null ? Number(companyProfile.max_contract_value) : "";
      setMinContractValue(minVal);
      setMaxContractValue(maxVal);
      setMinContractDisplay(minVal === "" ? "" : Number(minVal).toLocaleString());
      setMaxContractDisplay(maxVal === "" ? "" : Number(maxVal).toLocaleString());
      setCurrency(companyProfile.currency || "USD");
      setPreferredIndustries((companyProfile.preferred_industries || []).join(", "));
      setPreferredRegions((companyProfile.preferred_regions || []).join(", "));
      setDescription(companyProfile.description || "");
    }
  }, [companyProfile]);

  useEffect(() => {
    async function loadMembers() {
      if (!workspace) return;
      setLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from("workspace_members")
          .select("*")
          .eq("workspace_id", workspace.id);
        if (error) throw error;
        setMembers(data ?? []);
      } catch (err) {
        console.error("[Settings] Members load error:", err);
      } finally {
        setLoadingMembers(false);
      }
    }

    loadMembers();
  }, [workspace]);

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

            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Workspace Members</CardTitle>
                <CardDescription className="text-xs">
                  Users with authorized access to this organization&apos;s tenders and evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {loadingMembers ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl border border-border/60 bg-surface/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 rounded-full bg-secondary text-secondary-foreground items-center justify-center font-mono text-xs font-bold">
                          {m.user_id.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-mono text-xs text-foreground font-semibold">
                            User ID: {m.user_id.slice(0, 8)}...
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Joined {new Date(m.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs uppercase text-accent border-accent/60"
                      >
                        {m.role}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Billing & Subscription Intelligence */}
          <TabsContent value="billing" className="mt-4 space-y-6">
            <Card className="border border-border/80 shadow-panel bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-accent" /> Active Subscription & Commercial Entitlement
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deterministic capacity management and PayChangu commercial billing integration.
                  </CardDescription>
                </div>
                <Button asChild size="sm" className="bg-accent text-accent-foreground font-semibold hover:bg-accent/90 gap-1.5 shadow-sm">
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
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Plan</span>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold text-foreground">
                            {billingContext?.planConfig?.name || (workspace?.plan ? workspace.plan.toUpperCase() : "TRIAL")}
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
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Analysis Allowance</span>
                        <div className="font-display text-lg font-bold text-foreground">
                          {billingContext?.analysesAllowance === -1 ? "Unlimited" : `${billingContext?.analysesUsed ?? 0} / ${billingContext?.analysesAllowance ?? 3}`}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {billingContext?.analysesAllowance === -1
                            ? "Continuous AI qualification pipeline"
                            : `${billingContext?.remainingAnalyses ?? 0} analyses remaining this period`}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-border/60 bg-surface/40 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Evaluation / Renewal</span>
                        <div className="font-display text-lg font-bold text-foreground">
                          {workspace?.trial_ends_at
                            ? new Date(workspace.trial_ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
                        <span className="font-medium text-foreground">Monthly Capacity Utilization</span>
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
                        <h4 className="text-sm font-semibold text-foreground">Upgrade or Switch Commercial Plan</h4>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to Growth or Pro Enterprise with instant checkout via PayChangu (MWK / USD).
                        </p>
                      </div>
                      <Button asChild size="sm" className="bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-sm shrink-0">
                        <Link to="/billing">
                          View All Plans & Upgrade →
                        </Link>
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
