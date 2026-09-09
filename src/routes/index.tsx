import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  return (
    <div className="min-h-screen bg-canvas text-foreground font-sans antialiased selection:bg-primary-soft selection:text-primary">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src={logo} width={140} height={110} alt="BidRadar" />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary">
              <a href="#problem" className="hover:text-foreground transition-colors">
                The Problem
              </a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#qualification" className="hover:text-foreground transition-colors">
                Qualification
              </a>
              <a href="#trust" className="hover:text-foreground transition-colors">
                Enterprise Trust
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150"
              >
                <span>Dashboard ({workspace?.name || "Workspace"})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/tenders/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150 active:scale-[0.98]"
                >
                  <span>Analyze a Tender</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-2xl border border-border bg-surface shadow-elevated p-4 sm:p-7">
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
                        Demonstration UI
                      </Badge>
                    </div>
                    <h2 className="text-base sm:text-lg font-display font-bold text-foreground leading-snug">
                      Enterprise Cyber Defense & SOC Monitoring Services
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-review-soft border border-review/30 text-review text-xs font-mono font-bold">
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-primary block mb-2">
                  STAGE 01
                </span>
                <h3 className="font-display font-bold text-lg text-foreground mb-2">Add Tender</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Upload tender PDF/DOCX or provide a public URL to get started.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                Upload or Secure URL
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-primary block mb-2">
                  STAGE 02
                </span>
                <h3 className="font-display font-bold text-lg text-foreground mb-2">
                  Extract Requirements
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Structured AI models extract every mandatory condition, submission deadline,
                  technical specification, and evaluation criteria.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                Validated Extraction
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-primary block mb-2">
                  STAGE 03
                </span>
                <h3 className="font-display font-bold text-lg text-foreground mb-2">
                  Match Evidence
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Requirements are audited against your verified company certifications, past
                  contracts, key personnel, and capabilities.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                Company Knowledge Base
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-primary block mb-2">
                  STAGE 04
                </span>
                <h3 className="font-display font-bold text-lg text-foreground mb-2">
                  Decision Report
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  A scoring engine produces a BID, REVIEW, or NO-BID recommendation with citations,
                  blockers, and next steps.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60 text-[11px] font-mono text-bid font-bold">
                Scored Recommendation
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

      {/* Bottom CTA */}
      <section className="py-20 border-t border-border bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center  mb-6 ">
            <img src={logo} width={140} height={110} alt="BidRadar" />
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

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-canvas text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center">
              <img src={logo} width={140} height={130} alt="BidRadar" />
            </Link>

            <span>— Enterprise Contract Intelligence Engine</span>
          </div>
          <p>© {new Date().getFullYear()} GetBidRadar. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
