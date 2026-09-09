import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Globe2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumberWithCommas, parseFormattedNumber } from "@/lib/profile-utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    workspace,
    companyProfile,
    isOnboarded,
    isLoading: wsLoading,
    refetchWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form State mapped strictly to company_profiles schema
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

  // Sync with existing profile data
  useEffect(() => {
    if (companyProfile) {
      setCompanyName(companyProfile.company_name || "");
      setLegalName(companyProfile.legal_name || "");
      setIndustry(companyProfile.industry || "");
      setCountry(companyProfile.country || "");
      setWebsite(companyProfile.website || "");
      setEmployeeCount(companyProfile.employee_count ?? "");
      setYearsInOperation(companyProfile.years_in_operation ?? "");
      const minVal =
        companyProfile.min_contract_value != null ? Number(companyProfile.min_contract_value) : "";
      const maxVal =
        companyProfile.max_contract_value != null ? Number(companyProfile.max_contract_value) : "";
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

  // If already onboarded, redirect to dashboard
  useEffect(() => {
    if (!authLoading && isOnboarded) {
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, isOnboarded, navigate]);

  if (authLoading || wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-xs text-muted-foreground font-mono">Loading profile workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface gap-4 p-6 text-center">
        <h3 className="font-display text-lg font-bold text-foreground">Setting Up Workspace</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Your organization workspace is being provisioned. Click below to refresh your connection.
        </p>
        <Button onClick={() => refetchWorkspace()} size="sm">
          Connect Workspace
        </Button>
      </div>
    );
  }

  const parseArrayInput = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("company_profiles")
        .update({
          company_name: companyName.trim(),
          legal_name: legalName.trim() || null,
          industry: industry.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          employee_count: employeeCount === "" ? null : Number(employeeCount),
          years_in_operation: yearsInOperation === "" ? null : Number(yearsInOperation),
        })
        .eq("workspace_id", workspace.id);

      if (error) throw error;

      await supabase
        .from("workspaces")
        .update({ onboarding_step: 2, name: companyName.trim() || workspace.name })
        .eq("id", workspace.id);

      await refetchWorkspace();
      setStep(2);
    } catch (err) {
      toast.error("Error saving company details", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("company_profiles")
        .update({
          min_contract_value: minContractValue === "" ? null : Number(minContractValue),
          max_contract_value: maxContractValue === "" ? null : Number(maxContractValue),
          currency: currency.trim() || "USD",
          preferred_industries: parseArrayInput(preferredIndustries),
          preferred_regions: parseArrayInput(preferredRegions),
        })
        .eq("workspace_id", workspace.id);

      if (error) throw error;

      await supabase.from("workspaces").update({ onboarding_step: 3 }).eq("id", workspace.id);

      await refetchWorkspace();
      setStep(3);
    } catch (err) {
      toast.error("Error saving commercial parameters", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 20) {
      toast.error("Please provide at least a brief corporate overview (min 20 characters)");
      return;
    }

    setIsSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("company_profiles")
        .update({
          description: description.trim(),
        })
        .eq("workspace_id", workspace.id);

      if (profileErr) throw profileErr;

      const { error: wsErr } = await supabase
        .from("workspaces")
        .update({
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 3,
        })
        .eq("id", workspace.id);

      if (wsErr) throw wsErr;

      await refetchWorkspace();
      toast.success("Company profile calibrated successfully!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Error finalizing profile", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm">
            BR
          </div>
          <span className="font-display font-bold text-lg">
            GetBid<span className="text-accent">Radar</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            Setup Step {step} of 3
          </Badge>
        </div>
      </header>

      {/* Main Form Area */}
      <main className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* Progress Indicator */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, label: "Company Identity" },
              { num: 2, label: "Commercial Fit" },
              { num: 3, label: "Core Capabilities" },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                  step === s.num
                    ? "border-accent bg-card shadow-sm"
                    : step > s.num
                      ? "border-border bg-card/60 text-muted-foreground"
                      : "border-border/40 bg-surface/50 text-muted-foreground/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold">0{s.num}</span>
                  {step > s.num && <CheckCircle2 className="h-3.5 w-3.5 text-accent" />}
                </div>
                <span className="text-xs font-medium mt-1 truncate text-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: Company Profile */}
          {step === 1 && (
            <Card className="border border-border/80 shadow-panel bg-card">
              <form onSubmit={handleSaveStep1}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase text-accent mb-1">
                    <Building2 className="h-4 w-4" /> Company Identity
                  </div>
                  <CardTitle className="font-display text-2xl">Profile Calibration</CardTitle>
                  <CardDescription className="text-xs">
                    This information establishes your company facts for the automated requirement
                    matching engine.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-name" className="text-xs">
                        Company Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="c-name"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Apex Engineering Inc."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-legal" className="text-xs">
                        Legal Entity Name
                      </Label>
                      <Input
                        id="c-legal"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        placeholder="e.g. Apex Engineering Solutions LLC"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-ind" className="text-xs">
                        Primary Industry
                      </Label>
                      <Input
                        id="c-ind"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g. Civil Construction, IT Services"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-country" className="text-xs">
                        Country
                      </Label>
                      <Input
                        id="c-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="e.g. United States"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-web" className="text-xs">
                        Website URL
                      </Label>
                      <Input
                        id="c-web"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://apexeng.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-emp" className="text-xs">
                        Total Employees
                      </Label>
                      <Input
                        id="c-emp"
                        type="number"
                        min={1}
                        value={employeeCount}
                        onChange={(e) =>
                          setEmployeeCount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="e.g. 85"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-years" className="text-xs">
                        Years in Operation
                      </Label>
                      <Input
                        id="c-years"
                        type="number"
                        min={0}
                        value={yearsInOperation}
                        onChange={(e) =>
                          setYearsInOperation(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        placeholder="e.g. 12"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t border-border/40 pt-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        Continue to Commercial Fit <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* STEP 2: Commercial Fit */}
          {step === 2 && (
            <Card className="border border-border/80 shadow-panel bg-card">
              <form onSubmit={handleSaveStep2}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase text-accent mb-1">
                    <Globe2 className="h-4 w-4" /> Commercial Scope
                  </div>
                  <CardTitle className="font-display text-2xl">Bidding Parameters</CardTitle>
                  <CardDescription className="text-xs">
                    Define target contract values and geographic boundaries used by the Commercial
                    Fit scoring dimension.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-curr" className="text-xs">
                        Currency
                      </Label>
                      <Input
                        id="c-curr"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="USD"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-min" className="text-xs">
                        Minimum Contract Value
                      </Label>
                      <Input
                        id="c-min"
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
                      <Label htmlFor="c-max" className="text-xs">
                        Maximum Contract Value
                      </Label>
                      <Input
                        id="c-max"
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

                  <div className="space-y-1.5">
                    <Label htmlFor="c-p-ind" className="text-xs">
                      Target Industries (comma-separated)
                    </Label>
                    <Input
                      id="c-p-ind"
                      value={preferredIndustries}
                      onChange={(e) => setPreferredIndustries(e.target.value)}
                      placeholder="Infrastructure, Municipal Water, Renewable Energy"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tenders matching these sectors receive higher capability alignment.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="c-p-reg" className="text-xs">
                      Target Regions / Jurisdictions (comma-separated)
                    </Label>
                    <Input
                      id="c-p-reg"
                      value={preferredRegions}
                      onChange={(e) => setPreferredRegions(e.target.value)}
                      placeholder="North America, EU, East Coast"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border/40 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isSaving}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        Continue to Capabilities <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* STEP 3: Capabilities */}
          {step === 3 && (
            <Card className="border border-border/80 shadow-panel bg-card">
              <form onSubmit={handleCompleteOnboarding}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase text-accent mb-1">
                    <ShieldCheck className="h-4 w-4" /> Core Capabilities
                  </div>
                  <CardTitle className="font-display text-2xl">
                    Corporate Overview & Services
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Summarize your core competencies, past work domains, certifications, and
                    technical proficiencies. The evidence engine matches tender requirements against
                    this text and your document library.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-desc" className="text-xs">
                      Corporate Capability Statement <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="c-desc"
                      rows={6}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what your organization delivers, key engineering methodologies, proprietary tools, quality standards (ISO 9001, etc.), safety track record, and specific contract deliverables you excel in."
                      className="text-sm leading-relaxed"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The more detail provided, the higher the confidence of Phase 2 requirement
                      matching.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border/40 pt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={isSaving}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        Complete Setup & Launch Radar <CheckCircle2 className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
