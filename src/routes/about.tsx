import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import {
  Radar,
  ShieldCheck,
  Zap,
  Target,
  FileSearch,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Award,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About GetBidRadar | Procurement Bid Intelligence Platform" },
      {
        name: "description",
        content:
          "GetBidRadar was built to replace guesswork in procurement with evidence-backed bid decisions. Learn about our mission, philosophy, and how we help companies pursue the right contracts.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary-soft/40 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-xs font-mono font-semibold uppercase tracking-wider mb-6">
            <Radar className="h-3.5 w-3.5" />
            Our Mission & Philosophy
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-foreground tracking-tight leading-[1.1] mb-6">
            Eliminating Guesswork from Enterprise Procurement.
          </h1>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-3xl mx-auto mb-8">
            Every year, bidding teams spend hundreds of hours and thousands of dollars preparing proposals for tenders they were disqualified from before they even began. GetBidRadar was built to replace intuition with deterministic intelligence.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-bright shadow-panel transition-all duration-150"
            >
              <span>Start Free Evaluation</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium border border-border bg-surface hover:bg-surface-muted transition-all duration-150 text-foreground"
            >
              <span>Speak with Procurement Specialists</span>
            </Link>
          </div>
        </div>
      </section>

      {/* The Origin & Problem */}
      <section className="py-16 border-t border-border bg-surface/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground tracking-tight">
                Why Procurement Teams Need Deterministic Analysis
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Tender dossiers frequently span 80 to 250 pages of legal stipulations, technical standards, financial criteria, and mandatory certificates. A single overlooked clause — such as a specific ISO accreditation, turnover floor, or local partner requirement — results in immediate administrative disqualification.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                Generative AI alone is not enough. Hallucinating a requirement match or misinterpreting financial thresholds is unacceptable when millions in contract value are at stake.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Deterministic Scoring Authority:</strong> Mathematical criteria evaluation where every point is auditable and explainable.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Verified Corporate Evidence:</strong> Matches only against actual uploaded certificates, past performance records, and audited financials.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Evidence-backed decisions:</strong> Every qualification verdict links back to the exact tender clause and the company evidence that was — or wasn't — present.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl border border-border bg-surface shadow-panel space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">How GetBidRadar Works</h3>
                  <p className="text-xs text-muted-foreground font-mono">Evidence-backed qualification pipeline</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg border border-border bg-surface-muted/40">
                  <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                    <span>1. Autonomous Extraction</span>
                    <span className="font-mono text-primary text-[11px]">Server-side AI</span>
                  </div>
                  <p className="text-muted-foreground">
                    Deep OCR and structural parsing extract mandatory qualifications, deadlines, and evaluation weightings.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-border bg-surface-muted/40">
                  <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                    <span>2. Evidence Cross-Referencing</span>
                    <span className="font-mono text-primary text-[11px]">Private database</span>
                  </div>
                  <p className="text-muted-foreground">
                    Direct comparison against verified corporate certificates, employee CVs, and balance sheets.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-border bg-surface-muted/40">
                  <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                    <span>3. Deterministic Decision</span>
                    <span className="font-mono text-primary text-[11px]">Scoring engine</span>
                  </div>
                  <p className="text-muted-foreground">
                    Rule-based scoring engine produces an immutable BID, REVIEW, or NO-BID decision matrix.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-20 border-t border-border bg-canvas">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display font-bold text-3xl text-foreground tracking-tight mb-4">
              Our Core Architecture Principles
            </h2>
            <p className="text-sm text-text-secondary">
              Engineered from the ground up for compliance officers, bid managers, and executive directors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground">Strict Tenant Isolation</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Your bidding strategies, corporate documents, and financial metrics are quarantined using database-enforced Row Level Security (RLS). No competitor can ever inspect your data.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground">Explainable Decisions</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                We never produce "black-box" outputs. If a tender is categorized as NO-BID, the system cites the exact missing certificate, turnover shortfall, or non-negotiable legal blocker.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground">Collaborative Command</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Equip your estimators, technical writers, and directors with a centralized command center to assemble proposals, audit compliance, and submit on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 border-t border-border bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            Stop Guessing. Bid with Certainty.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
            Join engineering firms, consultancies, NGOs, and procurement teams that need to spend their time on contracts they can actually win.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-bright shadow-panel transition-all duration-150"
            >
              <span>Get Started Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
