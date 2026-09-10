import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  ShieldCheck,
  Lock,
  Users,
  Database,
  Server,
  Eye,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Key,
  Layers,
  Cpu,
  ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Trust | GetBidRadar" },
      {
        name: "description",
        content:
          "GetBidRadar security architecture: data isolation, access control, private document storage, server-side AI processing, and evidence traceability. Honest documentation of implemented security controls.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden border-b border-border">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary-soft/30 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-[11px] font-mono font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust & Security
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-foreground tracking-tight mb-6">
            Security architecture you can verify.
          </h1>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto">
            We document what we've actually built — not what sounds impressive. Every security
            control on this page reflects production-implemented behavior you can verify.
          </p>
        </div>
      </section>

      {/* Honest Disclaimer */}
      <section className="py-8 bg-amber-50/60 border-b border-amber-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong className="font-semibold">Honest security documentation.</strong>{" "}
              GetBidRadar does not claim SOC 2, ISO 27001, HIPAA, FedRAMP, or GDPR certification at
              this stage. We have not undergone formal third-party compliance audits. This page
              documents the security architecture as it is actually implemented. Trust comes from
              honesty, not from claiming certifications we haven't earned.
            </div>
          </div>
        </div>
      </section>

      {/* Core Security Controls */}
      <section className="py-16 sm:py-24 bg-canvas border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-4">
              What we've built
            </h2>
            <p className="text-base text-text-secondary max-w-xl mx-auto">
              These are the actual security controls implemented in the current production system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data Isolation */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Workspace Data Isolation
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Every workspace is a strictly isolated tenant. PostgreSQL Row Level Security (RLS)
                policies are enforced at the database layer on every table — tenders, requirements,
                company evidence, proposals, compliance records, submissions, and analytics.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>RLS enforced at PostgreSQL level — not just application code</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Workspace members can only read/write their own workspace data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Cross-tenant data access is not possible via the application API</span>
                </li>
              </ul>
            </div>

            {/* Private Storage */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Private Document Storage
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Tender documents, company evidence files, and supporting attachments are stored in
                private, RLS-protected storage buckets. Files are not publicly accessible — every
                download requires authenticated, workspace-scoped authorization.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Supabase Storage with private bucket configuration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Storage paths scoped per workspace — cryptographically isolated</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>No public file URLs are generated for sensitive documents</span>
                </li>
              </ul>
            </div>

            {/* Access Control */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Role-Based Access Control
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Workspace membership is managed through an explicit role system. Access is enforced
                at both the application and database layers.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Roles: Owner, Admin, Member, Reviewer</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Invitation-based team access — no open registration to existing workspaces</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Platform admin authority is database-enforced, not application-layer only</span>
                </li>
              </ul>
            </div>

            {/* Authentication */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Key className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Authentication
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Authentication is handled by Supabase Auth, which manages session tokens, password
                hashing, and email verification flows securely.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Email + password authentication with secure session tokens (JWTs)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Password reset via verified email flow</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Protected routes enforce server-side authentication checks</span>
                </li>
              </ul>
            </div>

            {/* Server-Side AI */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Server-Side AI Processing
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                All AI analysis runs exclusively on the server. API keys, document content, and
                company evidence never reach the browser or client-side code.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>AI provider API keys are server-only environment variables</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Document content is processed server-side and never returned raw to the browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Structured output schemas validated at runtime — no free-form AI text as business decisions</span>
                </li>
              </ul>
            </div>

            {/* Evidence Traceability */}
            <div className="p-6 rounded-2xl border border-border bg-surface shadow-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">
                  Evidence Traceability
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Every qualification verdict is backed by specific requirement clauses and company
                evidence records. We don't deliver unexplained scores — we show exactly why.
              </p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Each requirement match links to the specific tender clause and evidence record</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Evidence gaps are explicitly identified — not silently assumed as met</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-bid shrink-0 mt-0.5" />
                  <span>Qualification reports are auditable and persistent per workspace</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Responsible AI */}
      <section className="py-16 sm:py-24 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-canvas text-muted-foreground text-xs font-mono uppercase tracking-wider mb-4">
              Responsible AI
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-4">
              How we use AI responsibly
            </h2>
            <p className="text-base text-text-secondary">
              AI accelerates analysis. Humans make the final decision.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "AI assists — it doesn't decide",
                desc: "GetBidRadar uses AI to extract and structure tender requirements. A separate, deterministic scoring engine computes the final qualification score from your verified company evidence. AI does not independently determine whether you should bid.",
              },
              {
                title: "Your facts come from your evidence",
                desc: "Qualification scores are computed against company evidence you provide in your knowledge base. The system will not fabricate certifications, track records, or financial capacity you haven't documented.",
              },
              {
                title: "Missing information is flagged, not assumed",
                desc: "If a required qualification cannot be matched to your company's evidence, it is explicitly marked as a gap or unknown. We do not guess or assume qualifications are met.",
              },
              {
                title: "Recommendations should be reviewed",
                desc: "BID / REVIEW / NO-BID recommendations are starting points for human judgment, not final binding instructions. Your bid team should review the full evidence context before committing to pursue a contract.",
              },
              {
                title: "Your data is not used for model training",
                desc: "Your company evidence, tender documents, and workspace data are not used to train public AI models. They remain isolated to your workspace.",
              },
              {
                title: "AI provider transparency",
                desc: "GetBidRadar routes AI requests through a server-side gateway using commercial AI providers. We do not claim AI output is infallible. Extraction errors can occur on ambiguous or poorly formatted documents.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl border border-border bg-canvas"
              >
                <h3 className="font-display font-bold text-sm text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="py-16 sm:py-24 bg-canvas border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-muted-foreground text-xs font-mono uppercase tracking-wider mb-4">
              Infrastructure
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-4">
              What we've built on
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-border bg-surface text-center">
              <Server className="h-6 w-6 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-foreground mb-1">Supabase</h3>
              <p className="text-xs text-text-secondary">
                PostgreSQL database with Row Level Security, Auth, and private Storage.
                Hosted infrastructure managed by Supabase.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-surface text-center">
              <Layers className="h-6 w-6 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-foreground mb-1">Server-Side Rendering</h3>
              <p className="text-xs text-text-secondary">
                Application rendered server-side. Sensitive business logic executes on the
                server, not in the browser.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-surface text-center">
              <Eye className="h-6 w-6 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-foreground mb-1">Data Residency</h3>
              <p className="text-xs text-text-secondary">
                Data is stored in the region configured in your Supabase project. Specific
                residency guarantees depend on your project configuration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data practices */}
      <section className="py-16 sm:py-24 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-4">
              Data practices
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "What data do you collect?",
                a: "We collect the information you provide during registration (name, email, company), the tender documents and URLs you submit for analysis, and the company evidence you add to your knowledge base. We also collect usage metrics to enforce plan limits and improve the service.",
              },
              {
                q: "Who can see my company's tender documents?",
                a: "Only authenticated members of your workspace can access your workspace's documents. Database RLS policies prevent access by other workspaces. GetBidRadar platform operators can access data for support purposes when explicitly required — this is documented in our Terms of Service.",
              },
              {
                q: "Can I delete my data?",
                a: "You can delete individual tender analyses, requirements, and knowledge base entries from within the application. For full account and workspace deletion, contact us. We will fulfill deletion requests in accordance with our Privacy Policy.",
              },
              {
                q: "How long is my data retained?",
                a: "Active workspace data is retained as long as your workspace exists. Trial workspaces that have not been accessed for an extended period may be subject to cleanup as described in our Terms of Service. We do not sell your data.",
              },
            ].map((item) => (
              <div key={item.q} className="p-5 rounded-xl border border-border bg-canvas">
                <h3 className="font-display font-semibold text-sm text-foreground mb-2">
                  {item.q}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 sm:py-20 bg-canvas">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-[11px] font-mono font-semibold uppercase tracking-wider mb-6">
            <FileText className="h-3.5 w-3.5" />
            Security Questions
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-4">
            Security or compliance inquiry?
          </h2>
          <p className="text-base text-text-secondary mb-8">
            If you have questions about our security architecture, data handling, or require a
            security review before procurement, contact us directly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-bright shadow-panel transition-all"
            >
              Contact Us
              <ArrowRight className="h-4 w-4" />
            </Link>
           
          </div>
          <p className="text-xs text-muted-foreground mt-8">
            Also see our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            for full data processing commitments.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
