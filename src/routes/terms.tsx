import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
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
            <FileText className="h-3.5 w-3.5" /> Legal Agreement
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Last Updated: September 10, 2026 • Version 2.4
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-text-secondary text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing, or using GetBidRadar ("the Platform", "Service", "we", "us", or "our"), you ("Customer", "Subscriber", or "User") agree to be legally bound by these Terms of Service. If you are entering into this agreement on behalf of a company, organization, or legal entity, you represent and warrant that you have full legal authority to bind that entity.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">2. Service Description & Subscriptions</h2>
            <p>
              GetBidRadar provides a deterministic procurement intelligence, tender qualification, corporate evidence management, and bid command platform. Services are made available across multiple subscription tiers as published in our Pricing schedule:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>14-Day Evaluation (Trial):</strong> Up to 3 tender analyses for commercial qualification.</li>
              <li><strong>Starter Tier:</strong> 5 tender analyses per month, up to 3 team members.</li>
              <li><strong>Growth Tier:</strong> 25 tender analyses per month, up to 10 team members, priority multi-model fallback.</li>
              <li><strong>Pro Enterprise Tier:</strong> Unlimited tender analyses, unlimited team members, advanced compliance tracking.</li>
            </ul>
            <p>
              Allowances reset on a monthly billing cycle. Unused monthly analysis quotas do not roll over to subsequent billing periods.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">3. Customer Data & Intellectual Property</h2>
            <p>
              You retain all ownership, rights, title, and interest in and to any tender documents, RFP texts, company qualifications, past performance records, financial statements, and corporate credentials uploaded to the Platform ("Customer Data").
            </p>
            <p>
              We do not claim any ownership over your Customer Data. We will never sell your Customer Data or use your confidential proposals or tender submissions to train public artificial intelligence models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">4. Acceptable Use & Conduct</h2>
            <p>
              You agree not to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Upload malicious files, viruses, or documents containing exploits designed to bypass security boundaries;</li>
              <li>Attempt to reverse-engineer, decompile, or extract the proprietary scoring engine or internal algorithms;</li>
              <li>Circumvent multi-tenant Row Level Security or access another workspace's data;</li>
              <li>Use the Platform for any unlawful, deceptive, or anti-competitive bid rigging activities;</li>
              <li>Resell, sublicense, or rent access to third parties without prior written consent from GetBidRadar.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">5. Billing, Payments & Cancellations</h2>
            <p>
              Subscriptions are billed in advance on a recurring monthly or annual basis via our authorized payment partner, PayChangu, supporting Malawian Kwacha (MWK) and US Dollars (USD).
            </p>
            <p>
              All payments are non-refundable once processed, except where required by applicable consumer protection laws. You may cancel your subscription at any time via your Workspace Settings; your access will continue through the remainder of the currently paid billing period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">6. Decision Support Disclaimer & Limitation of Liability</h2>
            <p>
              GetBidRadar is a decision-support and procurement analysis tool. While our deterministic scoring engine evaluates tender requirements with rigorous precision, the final decision to bid, prepare proposals, and execute contracts rests solely with the Customer.
            </p>
            <p>
              To the maximum extent permitted by applicable law, GetBidRadar and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, lost contract opportunities, or disqualification by contracting authorities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">7. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Republic of Malawi, without regard to its conflict of law principles. Any dispute arising under these Terms shall be resolved by mutual consultation, or failing that, through competent commercial courts in Lilongwe or Blantyre.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">8. Inquiries & Legal Notices</h2>
            <p>
              If you have any questions regarding these Terms of Service or need to serve legal notice, please contact our legal counsel at:
            </p>
            <div className="p-4 rounded-xl border border-border bg-surface text-xs font-mono">
              <p>Email: legal@getbidradar.com / support@getbidradar.com</p>
              <p>Attn: Legal & Compliance Operations</p>
              <p>GetBidRadar Systems</p>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
