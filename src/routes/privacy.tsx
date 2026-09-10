import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary-soft text-primary text-xs font-mono font-semibold uppercase tracking-wider mb-4">
            <Lock className="h-3.5 w-3.5" /> Data Protection
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Last Updated: September 10, 2026 • Version 2.2
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-text-secondary text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">1. Commitment to Enterprise Privacy</h2>
            <p>
              GetBidRadar ("we", "our", or "us") is dedicated to protecting the confidentiality, integrity, and security of our customers' sensitive procurement documents, corporate evidence records, and personal account details. This Privacy Policy details how we collect, process, store, and protect your information when using our contract intelligence platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">2. Information We Collect</h2>
            <p>
              We collect only the information strictly necessary to provide the service:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>Account Identifiers:</strong> Name, work email address, company name, and encrypted authentication tokens.</li>
              <li><strong>Tender Documents:</strong> RFP files, PDF tender packages, and specifications uploaded by you for analysis.</li>
              <li><strong>Corporate Evidence:</strong> Tax compliance certificates, financial thresholds, past performance summaries, and staff qualifications stored in your workspace evidence base.</li>
              <li><strong>Billing Information:</strong> Transaction references, currency, and subscription records processed securely by our PCI-DSS certified payment gateway (PayChangu). We do not store raw credit card numbers.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">3. How Your Data Is Processed</h2>
            <p>
              Uploaded tender dossiers and evidence documents are processed strictly via our server-side ingestion pipeline:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>Optical Character Recognition & Parsing:</strong> Extracts text and tables directly on private server environments.</li>
              <li><strong>Deterministic Scoring:</strong> Mathematical algorithm evaluates compliance criteria against your workspace evidence without human intervention.</li>
              <li><strong>AI Acceleration:</strong> When extracting qualifications or summarizing complex clauses, data is sent via private server-to-server TLS connections to enterprise AI endpoints with strict zero-data-retention commitments. Your documents are never used to train public language models.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">4. Strict Multi-Tenant Data Isolation</h2>
            <p>
              We implement PostgreSQL Row Level Security (RLS) across every database table. Each query is authenticated against your unique workspace ID and user token. No user from another organization can access, query, or infer your tender dossiers or company qualifications. Storage objects are compartmentalized in isolated workspace buckets.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">5. Third-Party Service Subprocessors</h2>
            <p>
              We partner with industry-leading infrastructure providers to deliver high availability and security:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-3 rounded-lg border border-border bg-surface">
                <strong className="text-foreground block">Supabase</strong>
                <span className="text-muted-foreground">PostgreSQL Database, Auth & Encrypted Storage (AWS eu-central-1)</span>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface">
                <strong className="text-foreground block">Resend</strong>
                <span className="text-muted-foreground">Transactional Notifications & Bid Alert Delivery</span>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface">
                <strong className="text-foreground block">PayChangu</strong>
                <span className="text-muted-foreground">PCI-DSS Compliant Payment Processing (MWK / USD)</span>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface">
                <strong className="text-foreground block">Google Gemini & Qwen APIs</strong>
                <span className="text-muted-foreground">Server-side extraction with zero model training retention</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">6. Data Retention & Your Rights</h2>
            <p>
              You maintain complete sovereignty over your data:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>Right to Erase:</strong> You may delete any uploaded tender or evidence document at any time; deletion is immediately cascaded through storage buckets and database tables.</li>
              <li><strong>Account Deletion:</strong> Workspace owners can request full workspace teardown and permanent data destruction by contacting support.</li>
              <li><strong>Export:</strong> Export your requirements matrices, audit logs, and qualification reports at any time.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">7. Contact the Data Protection Officer</h2>
            <p>
              For data access requests, audit inquiries, or compliance questions, reach our Data Protection team at:
            </p>
            <div className="p-4 rounded-xl border border-border bg-surface text-xs font-mono">
              <p>Email: privacy@getbidradar.com / support@getbidradar.com</p>
              <p>Attn: Data Protection Officer</p>
              <p>GetBidRadar Security Operations</p>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
