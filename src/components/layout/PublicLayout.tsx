import React, { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X, ShieldCheck, Radar, ChevronRight } from "lucide-react";
import logo from "@/assets/bidradar.png";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="min-h-screen bg-canvas text-foreground font-sans antialiased flex flex-col selection:bg-primary-soft selection:text-primary">
      {/* Public Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logo} width={140} height={120} alt="BidRadar"  />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary">
              <Link
                to="/"
                className={`transition-colors hover:text-foreground ${currentPath === "/" ? "text-foreground font-semibold" : ""}`}
              >
                Home
              </Link>
              <Link
                to="/about"
                className={`transition-colors hover:text-foreground ${currentPath === "/about" ? "text-foreground font-semibold" : ""}`}
              >
                About
              </Link>
              <a
                href="/#pricing"
                className="transition-colors hover:text-foreground"
              >
                Pricing
              </a>
              <Link
                to="/support"
                className={`transition-colors hover:text-foreground ${currentPath === "/support" ? "text-foreground font-semibold" : ""}`}
              >
                Support
              </Link>
              <Link
                to="/contact"
                className={`transition-colors hover:text-foreground ${currentPath === "/contact" ? "text-foreground font-semibold" : ""}`}
              >
                Contact
              </Link>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
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
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-bright shadow-subtle transition-all duration-150 active:scale-[0.98]"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface px-4 pt-3 pb-5 space-y-3 shadow-panel">
            <div className="flex flex-col space-y-2 text-sm font-medium">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-muted text-text-secondary hover:text-foreground"
              >
                Home
              </Link>
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-muted text-text-secondary hover:text-foreground"
              >
                About
              </Link>
              <a
                href="/#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-muted text-text-secondary hover:text-foreground"
              >
                Pricing
              </a>
              <Link
                to="/support"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-muted text-text-secondary hover:text-foreground"
              >
                Support
              </Link>
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-muted text-text-secondary hover:text-foreground"
              >
                Contact
              </Link>
            </div>
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg text-xs font-semibold bg-primary text-white"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-lg text-xs font-medium border border-border"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-lg text-xs font-semibold bg-primary text-white"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 min-w-0">{children}</main>

      {/* Global 4-Column SaaS Footer */}
      <footer className="border-t border-border bg-surface text-xs text-muted-foreground pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-border/80">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <Link to="/" className="inline-block">
                <img src={logo} width={130} height={120} alt="BidRadar"/>
              </Link>
              <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
                GetBidRadar is the enterprise contract intelligence engine. We extract mandatory requirements, match verified corporate qualifications, and deliver deterministic BID / REVIEW / NO-BID decisions with zero hallucinations.
              </p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-primary/20 bg-primary-soft text-[11px] font-mono font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Deterministic Scoring Engine v2.0</span>
              </div>
            </div>

            {/* Col 1: Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Product
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/tenders/new" className="hover:text-foreground transition-colors">
                    Tender Intake
                  </Link>
                </li>
                <li>
                  <a href="/#qualification" className="hover:text-foreground transition-colors">
                    Qualification Matrix
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="hover:text-foreground transition-colors">
                    Subscription Plans
                  </a>
                </li>
                <li>
                  <Link to="/knowledge" className="hover:text-foreground transition-colors">
                    Corporate Evidence
                  </Link>
                </li>
                <li>
                  <Link to="/analytics" className="hover:text-foreground transition-colors">
                    Bid Analytics
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 2: Company & Support */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Support & Contact
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/about" className="hover:text-foreground transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="hover:text-foreground transition-colors">
                    Support Desk
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-foreground transition-colors">
                    Contact Sales
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@getbidradar.com" className="hover:text-foreground transition-colors">
                    support@getbidradar.com
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Legal & Trust */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Legal & Privacy
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/terms" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <span className="text-muted-foreground/80">
                    Malawi & International GDPR-Compliant
                  </span>
                </li>
                <li>
                  <span className="text-muted-foreground/80">
                    Strict Multi-Tenant RLS
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Subfooter */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <p>© {new Date().getFullYear()} GetBidRadar. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
