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
import { Building2, Users, Shield, Sparkles, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

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
  const [currency, setCurrency] = useState("USD");
  const [preferredIndustries, setPreferredIndustries] = useState("");
  const [preferredRegions, setPreferredRegions] = useState("");
  const [description, setDescription] = useState("");

  // Team State
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (companyProfile) {
      setCompanyName(companyProfile.company_name || "");
      setLegalName(companyProfile.legal_name || "");
      setIndustry(companyProfile.industry || "");
      setCountry(companyProfile.country || "");
      setWebsite(companyProfile.website || "");
      setEmployeeCount(companyProfile.employee_count ?? "");
      setYearsInOperation(companyProfile.years_in_operation ?? "");
      setMinContractValue(
        companyProfile.min_contract_value != null ? Number(companyProfile.min_contract_value) : "",
      );
      setMaxContractValue(
        companyProfile.max_contract_value != null ? Number(companyProfile.max_contract_value) : "",
      );
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
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span>Readiness:</span>
              <span className="font-bold text-foreground">{completenessScore}%</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              Role: {role || "member"}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full sm:w-80 grid-cols-2 bg-secondary/80">
            <TabsTrigger value="company" className="text-xs font-medium flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Company Profile
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-medium flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Team & Workspace
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
                        type="number"
                        value={minContractValue}
                        onChange={(e) =>
                          setMinContractValue(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s-max" className="text-xs">
                        Max Contract Value
                      </Label>
                      <Input
                        id="s-max"
                        type="number"
                        value={maxContractValue}
                        onChange={(e) =>
                          setMaxContractValue(e.target.value === "" ? "" : Number(e.target.value))
                        }
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
        </Tabs>
      </div>
    </AppShell>
  );
}
