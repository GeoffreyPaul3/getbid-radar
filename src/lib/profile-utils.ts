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
