import type { Database } from "@/integrations/supabase/types";

type CompanyProfile = Database["public"]["Tables"]["company_profiles"]["Row"];

export function calculateProfileCompleteness(profile: CompanyProfile | null): number {
  if (!profile) return 0;
  const checks: (boolean | number | string | null | undefined)[] = [
    Boolean(profile.company_name?.trim()),
    Boolean(profile.industry?.trim()),
    Boolean(profile.country?.trim()),
    Boolean(profile.description && profile.description.trim().length >= 20),
    (profile.employee_count ?? 0) > 0,
    (profile.years_in_operation ?? 0) > 0,
    Boolean(profile.website?.trim()),
    profile.min_contract_value != null || profile.max_contract_value != null,
    (profile.preferred_industries?.length ?? 0) > 0,
    (profile.preferred_regions?.length ?? 0) > 0,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

/**
 * Formats a raw numeric or partial string into a comma-separated thousands string (e.g. 100000 -> 100,000)
 * suitable for real-time keystroke entry.
 */
export function formatNumberWithCommas(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const intPart = parts[0];
  const formattedInt = intPart ? Number(intPart).toLocaleString("en-US") : "";

  if (parts.length > 1 && parts[1] !== undefined) {
    return `${formattedInt}.${parts[1].slice(0, 2)}`;
  }
  return formattedInt;
}

export function parseFormattedNumber(value: string): number | "" {
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "" || isNaN(Number(cleaned))) return "";
  return Number(cleaned);
}
