export type PlanTier = "trial" | "starter" | "growth" | "pro" | "enterprise";
export type BillingCurrency = "MWK" | "USD";

export interface PlanCapabilityBreakdown {
  opportunities: string;
  seats: string;
  companyIntelligence: string;
  bidIntelligence: string;
  collaboration: string;
  compliance: string;
  analytics: string;
  workflow: string;
}

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  tagline: string;
  description: string;
  monthlyPrice: Record<BillingCurrency, number>;
  opportunityAllowance: number; // monthly tender pursuits (-1 for custom/unlimited)
  analysisAllowance: number; // legacy alias for opportunityAllowance
  memberAllowance: number; // max workspace seats (-1 for custom/unlimited)
  isPurchasable: boolean;
  highlighted?: boolean;
  badge?: string;
  features: string[];
  capabilities?: PlanCapabilityBreakdown;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  trial: {
    tier: "trial",
    name: "14-Day Evaluation",
    tagline: "Commercial pursuit pilot",
    description: "Time-limited commercial evaluation for enterprise bid teams to qualify live tenders.",
    monthlyPrice: {
      MWK: 0,
      USD: 0,
    },
    opportunityAllowance: 3,
    analysisAllowance: 3,
    memberAllowance: 1,
    isPurchasable: false,
    features: [
      "3 live tender pursuits",
      "1 evaluator seat",
      "14-day evaluation pilot",
      "Deterministic 5-pillar qualification score",
      "BID / REVIEW / NO-BID recommendation",
      "Requirement gap breakdown",
      "Standard company capability matching",
    ],
    capabilities: {
      opportunities: "3 tender pursuits total",
      seats: "1 evaluator seat",
      companyIntelligence: "Standard company profile & core capabilities",
      bidIntelligence: "Deterministic qualification scoring (0-100) & recommendation",
      collaboration: "Individual evaluation workspace",
      compliance: "Mandatory qualification checklist",
      analytics: "Pursuit qualification summary",
      workflow: "Document upload & URL extraction",
    },
  },
  starter: {
    tier: "starter",
    name: "Starter",
    tagline: "For boutique consultancies & specialist contractors",
    description: "Essential qualification intelligence and pursuit execution for focused bidding teams.",
    monthlyPrice: {
      MWK: 85_000,
      USD: 49,
    },
    opportunityAllowance: 10,
    analysisAllowance: 10,
    memberAllowance: 3,
    isPurchasable: true,
    features: [
      "10 tender pursuits per month",
      "3 workspace team seats (Owner, Admin, Member, Viewer)",
      "Deterministic 5-pillar qualification scoring",
      "Requirement extraction & gap matrix",
      "Company past performance repository (up to 25 projects)",
      "Bid workspace & team task management",
      "Proposal section drafting & document export",
      "Basic win/loss recording",
    ],
    capabilities: {
      opportunities: "10 opportunities / month (unlimited retries per pursuit)",
      seats: "3 team seats with role permissions",
      companyIntelligence: "Company profile, 25 past projects & team credentials",
      bidIntelligence: "Deterministic 5-pillar scoring & gap detection",
      collaboration: "Bid workspace & task board",
      compliance: "Automated compliance matrix & red flag warnings",
      analytics: "Pursuit stage tracking & win/loss outcome log",
      workflow: "Proposal section drafting & PDF document export",
    },
  },
  growth: {
    tier: "growth",
    name: "Growth",
    tagline: "For active bidding organizations & contractors",
    description: "Comprehensive qualification, cross-functional pursuit coordination, and win intelligence.",
    monthlyPrice: {
      MWK: 220_000,
      USD: 129,
    },
    opportunityAllowance: 35,
    analysisAllowance: 35,
    memberAllowance: 10,
    isPurchasable: true,
    highlighted: true,
    badge: "Recommended",
    features: [
      "35 tender pursuits per month",
      "10 workspace team seats with role-based access control",
      "Full deterministic scoring with win themes & differentiators",
      "Evidence repository with document cross-referencing (up to 100 projects)",
      "Bid Command Center with stage pipeline & task assignments",
      "Compliance audit engine & disqualification risk detection",
      "Win/loss analytics dashboard & competitor tracking",
      "Automated deadline alerts (7d, 3d, 24h) & submission confirmation",
    ],
    capabilities: {
      opportunities: "35 opportunities / month (unlimited retries per pursuit)",
      seats: "10 team seats with full role-based access control",
      companyIntelligence: "Advanced repository: 100 projects, CVs & certifications",
      bidIntelligence: "Deterministic scoring, win themes & competitive positioning",
      collaboration: "Multi-seat Bid Command Center & task assignments",
      compliance: "In-depth compliance audit & disqualification risk alerts",
      analytics: "Win rate analytics, competitor insights & outcome trends",
      workflow: "End-to-end lifecycle, deadline alerts & submission receipts",
    },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "For dedicated bid divisions & high-volume contractors",
    description: "High-capacity pursuit operations, deep compliance audits, and strategic intelligence.",
    monthlyPrice: {
      MWK: 510_000,
      USD: 299,
    },
    opportunityAllowance: 100, // Capped to eliminate "unlimited" cost risk
    analysisAllowance: 100,
    memberAllowance: 25, // Capped to eliminate "unlimited" risk
    isPurchasable: true,
    badge: "High Capacity",
    features: [
      "100 tender pursuits per month",
      "25 workspace team seats with departmental access control",
      "Priority qualification queue processing",
      "Unlimited company past performance & evidence repository",
      "Advanced Bid Command Center with review sign-off workflows",
      "Comprehensive compliance matrix & audit export",
      "Full pursuit intelligence: competitor benchmarks & loss cause analysis",
      "Custom proposal templates & audit trail export",
      "Priority email & technical support",
    ],
    capabilities: {
      opportunities: "100 opportunities / month (unlimited retries per pursuit)",
      seats: "25 team seats with departmental access control",
      companyIntelligence: "Unlimited verified project repository & accreditations",
      bidIntelligence: "Priority qualification queue & executive briefs",
      collaboration: "Review sign-off workflows & full audit trail export",
      compliance: "Comprehensive compliance matrix & audit-ready export",
      analytics: "Competitor pricing benchmarks & loss cause repository",
      workflow: "Custom proposal templates & deadline escalation alerts",
    },
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "For multi-subsidiary corporations & prime contractors",
    description:
      "Tailored pursuit capacity, custom evaluation rubrics, dedicated onboarding, and enterprise SLA.",
    monthlyPrice: {
      MWK: 0,
      USD: 0,
    },
    opportunityAllowance: -1, // Custom / tailored volume
    analysisAllowance: -1,
    memberAllowance: -1, // Custom / unlimited seats
    isPurchasable: false, // Handled via enterprise sales inquiry
    badge: "Custom / Dedicated",
    features: [
      "Custom pursuit volume (150+ opportunities per month)",
      "Custom team seats with SSO & directory sync",
      "Bespoke deterministic scoring rubrics & domain tuning",
      "Multi-subsidiary evidence federation",
      "Custom governance, legal sign-offs & policy checks",
      "Custom BI pipeline reporting & forecasting",
      "Dedicated customer success manager & team training",
      "99.9% uptime SLA & priority 24/7 escalation",
    ],
    capabilities: {
      opportunities: "Custom monthly pursuit volume (150+ opportunities)",
      seats: "Custom / unlimited seats with SSO / SAML",
      companyIntelligence: "Multi-subsidiary federation & custom schemas",
      bidIntelligence: "Bespoke qualification rubrics & domain tuning",
      collaboration: "Custom RBAC & multi-division workspace isolation",
      compliance: "Custom governance & legal review workflows",
      analytics: "Custom BI exports & executive quarterly briefings",
      workflow: "ERP/CRM integrations & dedicated SLA",
    },
  },
};

export const PURCHASABLE_PLANS: PlanTier[] = ["starter", "growth", "pro"];
export const SUPPORTED_CURRENCIES: BillingCurrency[] = ["USD", "MWK"];

export function isPlanTier(value: unknown): value is PlanTier {
  return (
    typeof value === "string" &&
    (value === "trial" ||
      value === "starter" ||
      value === "growth" ||
      value === "pro" ||
      value === "enterprise")
  );
}

export function isPurchasablePlan(value: unknown): value is "starter" | "growth" | "pro" {
  return (
    typeof value === "string" && (value === "starter" || value === "growth" || value === "pro")
  );
}

export function isBillingCurrency(value: unknown): value is BillingCurrency {
  return value === "MWK" || value === "USD";
}

export function getPlanConfig(tier: PlanTier): PlanConfig {
  const config = PLAN_CONFIGS[tier];
  if (!config) {
    throw new Error(`Invalid plan tier: ${tier}`);
  }
  return config;
}

export function getPlanPrice(tier: PlanTier, currency: BillingCurrency): number {
  const config = getPlanConfig(tier);
  const price = config.monthlyPrice[currency];
  if (price === undefined) {
    throw new Error(`Unsupported currency ${currency} for plan ${tier}`);
  }
  return price;
}

export function formatBillingAmount(amount: number, currency: BillingCurrency): string {
  if (currency === "MWK") {
    return `MWK ${amount.toLocaleString("en-US")}`;
  }
  return `$${amount.toLocaleString("en-US")}`;
}

export interface VerifyPaymentResult {
  status: "successful" | "pending" | "failed" | "verification_failed";
  plan: PlanTier;
  amount: number;
  currency: BillingCurrency;
  txRef: string;
  message: string;
  activatedAt?: string;
  alreadyActivated?: boolean;
}

export interface WorkspaceBillingContext {
  workspaceId: string;
  plan: PlanTier;
  planConfig: PlanConfig;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  isTrial: boolean;
  opportunitiesUsed: number;
  opportunitiesAllowance: number; // -1 for unlimited/custom
  remainingOpportunities: number | null; // null if unlimited
  // Legacy aliases for backward compatibility
  analysesUsed: number;
  analysesAllowance: number;
  remainingAnalyses: number | null;
  // Seats
  memberSeatsUsed?: number;
  memberSeatsAllowance?: number;
  canAnalyze: boolean;
  blockReason: "TRIAL_EXPIRED" | "ALLOWANCE_EXCEEDED" | "SUBSCRIPTION_INACTIVE" | null;
  periodStart: string;
  periodEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewalDate: string | null;
  /** Human-readable countdown, e.g. "Renews in 24 days" or "Trial ends in 3 days" */
  countdownText: string;
}
