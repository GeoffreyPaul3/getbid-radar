import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PLAN_CONFIGS,
  PURCHASABLE_PLANS,
  formatBillingAmount,
  type BillingCurrency,
} from "@/lib/billing/plans";
import logo from "@/assets/bidradar.png";
import {
  Radar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Layers,
  Sparkles,
  Lock,
  Clock,
  Building2,
  ChevronRight,
  HelpCircle,
  Check,
  Search,
  FileCheck2,
  ShieldAlert,
  Send,
  Trophy,
  Briefcase,
  ListTodo,
  CheckSquare,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [currency, setCurrency] = useState<BillingCurrency>("USD");

  return (
    <PublicLayout>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary-soft/40 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-[11px] font-mono font-semibold uppercase tracking-wider mb-6">
              <FileCheck2 className="h-3.5 w-3.5" />
              Contract Intelligence Platform
            </div>
            <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-foreground tracking-tight leading-[1.1] mb-6">
              Know which contracts are worth pursuing before you waste time bidding.
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-8 max-w-2xl mx-auto">
              GetBidRadar analyzes tender requirements against your company's actual capabilities,
              experience, certifications, resources, and evidence to help you decide whether an
              opportunity deserves your attention.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/tenders/new"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-bright shadow-panel transition-all duration-150 active:scale-[0.98]"
              >
                <span>Analyze a Tender</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-surface border border-border text-foreground hover:bg-surface-muted transition-colors"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Hero Product UI Composition (Demonstration Mockup) */}
          <div className="relative max-w-5xl mx-auto group">
            {/* Ambient decorative glow */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-70 blur-xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-2xl -z-10" />

            <div className="rounded-2xl border border-border/90 bg-surface shadow-elevated p-4 sm:p-7 transition-all duration-300">
              {/* Product Lifecycle Navigation Strip */}
              <div className="flex items-center justify-between gap-2 pb-4 mb-5 border-b border-border/70 overflow-x-auto text-[11px] font-mono">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-1 rounded-md bg-primary text-white font-bold flex items-center gap-1">
                    <Search className="h-3 w-3" /> 01 Analyze
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="px-2.5 py-1 rounded-md bg-review-soft text-review font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> 02 Decide
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="px-2.5 py-1 rounded-md bg-surface-muted text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-3 w-3" /> 03 Prepare
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="px-2.5 py-1 rounded-md bg-surface-muted text-muted-foreground flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> 04 Audit
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="px-2.5 py-1 rounded-md bg-surface-muted text-muted-foreground flex items-center gap-1">
                    <Send className="h-3 w-3" /> 05 Submit
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="px-2.5 py-1 rounded-md bg-surface-muted text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> 06 Learn
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Deterministic Authority</span>
                </div>
              </div>

              {/* Product Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase">
                        TDR-2026-089
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-border">
                        Illustrative Production Data Model
                      </Badge>
                    </div>
                    <h2 className="text-base sm:text-lg font-display font-bold text-foreground leading-snug">
                      Enterprise Cyber Defense &amp; SOC Monitoring Services
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-review-soft border border-review/30 text-review text-xs font-mono font-bold shadow-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    REVIEW RECOMMENDATION
                  </div>
                </div>
              </div>

              {/* Intelligence Pipeline Narrative Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-5 border-b border-border/70 text-center sm:text-left">
                <div className="p-3 rounded-lg bg-surface-muted/50 border border-border/60">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                    01. Tender Ingestion
                  </span>
                  <p className="text-sm font-bold text-foreground">142 Pages Parsed</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">RFP Specifications</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-muted/50 border border-border/60">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                    02. Requirements
                  </span>
                  <p className="text-sm font-bold text-foreground">22 Mandatory Clauses</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Extracted & Structured</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-muted/50 border border-border/60">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                    03. Evidence Match
                  </span>
                  <p className="text-sm font-bold text-bid flex items-center justify-center sm:justify-start gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 18 Verified Records
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">4 Identified Gaps</p>
                </div>
                <div className="p-3 rounded-lg bg-primary-soft/40 border border-primary/20">
                  <span className="text-[10px] font-mono uppercase text-primary font-semibold block mb-1">
                    04. Qualification
                  </span>
                  <p className="text-sm font-bold text-primary">78 / 100 Score</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">82% Confidence</p>
                </div>
              </div>

              {/* Intelligence Details Row */}
              <div className="pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Score & Factors */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground">
                      Eight-Factor Evaluation Breakdown
                    </span>
                    <span className="text-muted-foreground font-mono">Qualification Score</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40">
                      <span className="text-text-secondary">Eligibility</span>
                      <span className="font-mono font-bold text-bid">95/100 (MATCH)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40">
                      <span className="text-text-secondary">Capability</span>
                      <span className="font-mono font-bold text-bid">85/100 (MATCH)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40">
                      <span className="text-text-secondary">Experience</span>
                      <span className="font-mono font-bold text-bid">80/100 (MATCH)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-muted/40">
                      <span className="text-text-secondary">Commercial Fit</span>
                      <span className="font-mono font-bold text-review">70/100 (PARTIAL)</span>
                    </div>
                  </div>
                </div>

                {/* Blocker Callout */}
                <div className="p-3.5 rounded-xl border border-nobid/30 bg-nobid-soft/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-nobid text-xs font-bold mb-1">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      Critical Evidence Gap
                    </div>
                    <p className="text-xs text-foreground font-medium">ISO 27001 Certification</p>
                    <p className="text-[11px] text-text-secondary mt-1">
                      Mandatory clause 4.2 requires accredited certificate. Confirmed absent in
                      uploaded records.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-nobid/20 text-[10px] font-mono text-nobid flex items-center justify-between">
                    <span>SEVERITY: CRITICAL</span>
                    <span>ACTION: RESOLVE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Micro-caption */}
            <p className="text-center text-xs text-muted-foreground font-mono mt-3">
              Illustrative GetBidRadar contract report. Scores are computed from your company
              profile.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section id="problem" className="py-16 sm:py-24 border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-foreground tracking-tight mb-4">
              Bidding on the wrong contracts costs enterprise teams hundreds of hours.
            </h2>
            <p className="text-base text-text-secondary">
              Most procurement and bid teams spend 20 to 60 hours reading 100-page tenders, drafting
              responses, and chasing partner certifications—only to discover an unfillable
              compliance gap on page 84.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl border border-border bg-surface-muted/30">
              <div className="h-10 w-10 rounded-xl bg-nobid-soft text-nobid flex items-center justify-center mb-4">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Late Disqualification
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Finding out too late that a client requires specific local certifications or bonding
                that your firm cannot provide.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface-muted/30">
              <div className="h-10 w-10 rounded-xl bg-review-soft text-review flex items-center justify-center mb-4">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Subjective Guesswork
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Relying on executive intuition rather than comparing requirements systematically
                against verified company track records.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface-muted/30">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Disconnected Execution
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                When a tender is approved, teams start from scratch in spreadsheets rather than
                building upon extracted requirement intelligence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Narrative */}
      <section id="how-it-works" className="py-16 sm:py-24 border-t border-border bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-muted-foreground text-xs font-mono uppercase tracking-wider mb-4">
              Intelligence Flow
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-foreground tracking-tight mb-4">
              The four stages of contract qualification.
            </h2>
            <p className="text-base text-text-secondary">
              A systematic pipeline connecting raw documents to confident pursuit decisions.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Desktop connecting progression line */}
            <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-primary/30 via-accent/30 to-bid/40 -translate-y-6 -z-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {/* Stage 01 */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle hover:border-primary/40 hover:shadow-card transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-primary bg-primary-soft px-2 py-0.5 rounded">
                      01
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-2">Add Tender</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Upload tender PDF/DOCX or provide a public URL. Ingests large multi-page tenders into secure isolated storage.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Input: PDF / DOCX / URL</span>
                  <span className="text-primary font-bold">→</span>
                </div>
              </div>

              {/* Stage 02 */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle hover:border-primary/40 hover:shadow-card transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-primary bg-primary-soft px-2 py-0.5 rounded">
                      02
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <CheckSquare className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-2">
                    Extract Requirements
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Extract mandatory conditions, deadlines, technical specifications, and evaluation criteria into a structured register.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Output: Clause Matrix</span>
                  <span className="text-primary font-bold">→</span>
                </div>
              </div>

              {/* Stage 03 */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle hover:border-primary/40 hover:shadow-card transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-primary bg-primary-soft px-2 py-0.5 rounded">
                      03
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-2">
                    Match Evidence
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Match requirements against verified company evidence: ISO certs, track records, key personnel, and financial capacity.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Audit: Knowledge Base</span>
                  <span className="text-primary font-bold">→</span>
                </div>
              </div>

              {/* Stage 04 */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle hover:border-primary/40 hover:shadow-card transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-bid bg-bid-soft px-2 py-0.5 rounded">
                      04
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bid-soft text-bid">
                      <Trophy className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-2">
                    Decision Report
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Produce BID, REVIEW, or NO-BID with mathematical scoring, identified blockers, evidence citations, and next actions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-bid font-bold">
                  <span>Verdict: BID / REVIEW / NO-BID</span>
                  <span>✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Qualification Engine Dimensions */}
      <section id="qualification" className="py-16 sm:py-24 border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-foreground tracking-tight mb-4">
              Eight qualification dimensions.
            </h2>
            <p className="text-base text-text-secondary">
              AI evaluates qualitative factors and your company evidence; the scoring engine
              computes the final qualification verdict.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              {
                title: "Eligibility",
                weight: "15%",
                desc: "Legal status, certifications, licenses, and jurisdictional authority.",
              },
              {
                title: "Capability",
                weight: "20%",
                desc: "Technical specifications, equipment, methodologies, and operational readiness.",
              },
              {
                title: "Experience",
                weight: "15%",
                desc: "Demonstrated past performance on contracts of equivalent scope and scale.",
              },
              {
                title: "Commercial Fit",
                weight: "15%",
                desc: "Contract value thresholds, margin viability, bonding, and financial covenants.",
              },
              {
                title: "Resource Fit",
                weight: "10%",
                desc: "Key personnel staffing, team availability, and bandwidth for execution.",
              },
              {
                title: "Deadline Fit",
                weight: "10%",
                desc: "Submission timeline realism, clarification periods, and schedule runway.",
              },
              {
                title: "Risk Profile",
                weight: "10%",
                desc: "Onerous liability clauses, uncapped penalties, and indemnification exposures.",
              },
              {
                title: "Evidence Strength",
                weight: "5%",
                desc: "Audit certainty backed by verified company records and documentation.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-4 rounded-xl border border-border bg-surface-muted/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-sm text-foreground">{f.title}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{f.weight}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Trust & Security */}
      <section id="trust" className="py-16 sm:py-24 border-t border-border bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-muted-foreground text-xs font-mono uppercase tracking-wider mb-4">
              Security Architecture
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-foreground tracking-tight mb-4">
              Built for high-stakes enterprise contracts.
            </h2>
            <p className="text-base text-text-secondary">
              Strict multi-tenant boundary isolation, private encrypted storage, and server-side AI
              execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Private Document Vault
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Tender files and company evidence are stored in tenant-isolated Supabase storage
                buckets protected by row-level security (RLS) policies.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Server-Side AI Gateway
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                All AI interactions route through a server-only gateway with strict prompt-injection
                boundaries. No API keys or document secrets are ever exposed to the client.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                Evidence Traceability
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Every requirement match provides an explicit audit trail linking back to specific
                document pages, sections, and company records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 lg:py-28 border-t border-border bg-surface/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-xs font-mono font-semibold uppercase tracking-wider mb-4">
              <Receipt className="h-3.5 w-3.5" /> Commercial Plans
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
              Transparent, Value-Aligned Pricing
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Scale your tender evaluation capacity without per-user penalties. Win more contracts with deterministic qualification rigor.
            </p>

            {/* Currency Switcher */}
            <div className="mt-8 inline-flex items-center rounded-lg border border-border bg-surface p-1 shadow-subtle">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  currency === "USD"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("MWK")}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  currency === "MWK"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:text-foreground"
                }`}
              >
                Malawian Kwacha (MWK)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {PURCHASABLE_PLANS.map((tierKey) => {
              const plan = PLAN_CONFIGS[tierKey];
              const isPopular = plan.highlighted;

              return (
                <div
                  key={tierKey}
                  className={`flex flex-col rounded-2xl border transition-all duration-200 relative ${
                    isPopular
                      ? "border-primary bg-surface shadow-panel ring-2 ring-primary/20"
                      : "border-border bg-surface/80 shadow-subtle hover:border-border/80"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-3.5 py-1 rounded-full bg-primary text-white text-[11px] font-mono font-semibold uppercase tracking-wider shadow-sm">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="p-6 sm:p-8 flex-1 flex flex-col">
                    <div className="mb-6">
                      <h3 className="font-display font-bold text-xl text-foreground">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mb-6 pb-6 border-b border-border/80">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display font-extrabold text-3xl sm:text-4xl text-foreground">
                          {formatBillingAmount(plan.monthlyPrice[currency], currency)}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          / month
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">
                        {plan.analysisAllowance === -1
                          ? "Unlimited tender evaluations"
                          : `${plan.analysisAllowance} tender evaluations / mo`}
                      </p>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1 text-xs">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2">
                      <Link
                        to="/login"
                        className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold transition-all ${
                          isPopular
                            ? "bg-primary text-white hover:bg-primary-bright shadow-sm"
                            : "bg-surface border border-border text-foreground hover:bg-surface-muted"
                        }`}
                      >
                        <span>Select {plan.name}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Evaluation Callout Banner */}
          <div className="mt-12 p-6 rounded-2xl border border-primary/20 bg-primary-soft/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="space-y-1">
              <h4 className="font-display font-bold text-sm text-foreground">
                Evaluating for an enterprise bid team?
              </h4>
              <p className="text-xs text-text-secondary">
                Every new workspace includes a 14-day commercial pilot with 3 full tender qualifications and evidence cross-referencing.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-bright shrink-0"
            >
              <span>Start Free Pilot</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 border-t border-border bg-canvas">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-xs font-mono font-semibold uppercase tracking-wider mb-4">
              <HelpCircle className="h-3.5 w-3.5" /> Common Questions
            </div>
            <h2 className="font-display font-bold text-3xl text-foreground tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Everything you need to know about deterministic tender intelligence.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            <AccordionItem value="item-1" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                How does the deterministic scoring engine make qualification decisions?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                Unlike general chat models that guess or produce probabilistic summaries, GetBidRadar uses an immutable mathematical engine as the sole authority. Mandatory requirements are extracted into structured parameters (financial turnover thresholds, ISO certifications, technical credentials, local registration) and evaluated against your verified corporate evidence base. A score from 0 to 100 is computed, delivering a transparent BID, REVIEW, or NO-BID decision where every single point is backed by audited document citations.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                Can the system hallucinate qualifications or tender requirements?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                No. Our architecture strictly separates AI extraction from evaluation authority. When the AI parses tender specifications, it must output typed JSON validated against strict runtime Zod schemas. If a qualification is missing or ambiguous in your corporate evidence, the scoring engine marks it explicitly as UNKNOWN or FAIL — it will never fabricate credentials.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                What file types and tender sizes are supported?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                GetBidRadar supports scanned and native PDF documents, Microsoft Word files (.docx), and public RFP web links. Documents up to 50 MB and 300+ pages are handled through our multi-phase chunking and optical character recognition (OCR) engine.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                Is our company data and evidence base confidential?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                Yes, completely. We enforce database-level PostgreSQL Row Level Security (RLS) on every table and isolated cryptographic storage paths per workspace. Your bidding history, past performance summaries, and staff qualifications cannot be accessed or viewed by any other tenant or user. Furthermore, your data is never used to train public AI models.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                Which payment methods and currencies do you support?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                Through our integration with PayChangu, we accept major credit and debit cards, mobile money transfers (Airtel Money, Mpamba), and direct bank transfers. We natively support Malawian Kwacha (MWK) and US Dollars (USD).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                How do deadline reminders and automated alerts work?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                When you mark a tender as "Pursuing" or "Preparing", the system schedules automated reminders at 7 days, 3 days, and 24 hours prior to the submission deadline. Alerts are delivered via email and posted to your workspace notification center so your team never misses a critical tender closing.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border border-border rounded-xl px-5 bg-surface shadow-subtle">
              <AccordionTrigger className="text-sm font-semibold text-foreground py-4 hover:no-underline">
                Can our entire proposal and estimating team work together?
              </AccordionTrigger>
              <AccordionContent className="text-xs text-text-secondary leading-relaxed pb-4">
                Yes. Workspaces support multiple team members with role-based access control (Owner, Admin, Member, Reviewer). You can invite colleagues by email, assign proposal sections, track readiness metrics, and collaborate in real time.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-border bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <img src={logo} width={140} height={120} alt="BidRadar" />
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight mb-4">
            Evaluate your next contract with decision intelligence.
          </h2>
          <p className="text-base text-text-secondary mb-8 max-w-xl mx-auto">
            Upload your tender document or paste a public RFP URL to extract mandatory requirements
            and receive an objective qualification report.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tenders/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-bright shadow-panel transition-all duration-150 active:scale-[0.98]"
            >
              <span>Analyze a Tender Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
