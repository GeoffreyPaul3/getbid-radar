/**
 * Evidence semantics regression test.
 * Verifies that company-level evidence NEVER satisfies individual-level requirements.
 * Example: Nuerex Labs located in Malawi does NOT satisfy personal individual
 * residency or citizenship in a World Bank member country.
 */
import { describe, expect, it } from "vitest";
import { ensureServerEnv } from "../server-env";
import { matchRequirements } from "./operations.server";
import type { EvidenceItem } from "./evidence.server";

ensureServerEnv();

describe("Evidence Semantics & Quality Regression", () => {
  it("marks individual-level citizenship/residency requirement as UNKNOWN even if company profile has a country", async () => {
    const requirements = [
      {
        ref: "req-wb-residency",
        title: "Residency/citizenship in a World Bank member country",
        description:
          "All participating team members must hold citizenship or legal residency in a World Bank member country.",
        category: "eligibility",
        isMandatory: true,
        importance: "critical",
        thresholdValue: "World Bank member country",
        evidenceNeeded: "Government-issued passport or national ID for each participant",
      },
      {
        ref: "req-corp-registration",
        title: "Registered Business Entity",
        description: "Company must be a legally registered business enterprise.",
        category: "legal_registration",
        isMandatory: true,
        importance: "high",
        thresholdValue: null,
        evidenceNeeded: "Certificate of Incorporation",
      },
    ];

    const companyFacts = {
      profile: {
        company_name: "Nuerex Labs",
        country: "Malawi",
        legal_name: "Nuerex Labs Ltd.",
      },
      capabilities: [
        {
          kind: "service",
          name: "AI Solutions",
          description: "Machine learning engineering",
        },
      ],
      certifications: [],
      projects: [],
      team: [], // No individual team member passports or residency records provided
      referenceCount: 0,
    };

    const evidence: EvidenceItem[] = [
      {
        id: "ev-profile-malawi",
        origin: "company_profile",
        sourceId: "cp-1",
        knowledgeDocumentId: null,
        companyProjectId: null,
        certificationId: null,
        label: "Company Profile: Country & Location",
        excerpt: "Nuerex Labs is located in Lilongwe, Malawi.",
        sourceReference: "company_profiles.country",
        relevance: 0.8,
        strength: "strong",
      },
      {
        id: "ev-corp-reg",
        origin: "company_profile",
        sourceId: "cp-1",
        knowledgeDocumentId: null,
        companyProjectId: null,
        certificationId: null,
        label: "Certificate of Incorporation",
        excerpt: "Nuerex Labs Ltd. registered under Companies Act of Malawi #10294.",
        sourceReference: "company_profiles.legal_name",
        relevance: 0.9,
        strength: "strong",
      },
    ];

    const result = await matchRequirements({
      requirements,
      company: companyFacts,
      evidence,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const matches = result.data.matches;
      expect(matches).toHaveLength(2);

      const residencyMatch = matches.find((m) => m.requirement_ref === "req-wb-residency");
      expect(residencyMatch).toBeDefined();

      // Crucial assertion: Company country must NOT satisfy individual-level citizenship/residency!
      // Must be unknown (or no_match if explicitly disproven), NEVER match!
      expect(residencyMatch?.verdict).not.toBe("match");
      expect(["unknown", "partial", "no_match"]).toContain(residencyMatch?.verdict);
      expect(residencyMatch?.confidence).toBeLessThanOrEqual(0.7);

      // Corporate registration CAN be matched by corporate registration evidence
      const regMatch = matches.find((m) => m.requirement_ref === "req-corp-registration");
      expect(regMatch).toBeDefined();
      expect(regMatch?.verdict).toBe("match");
    }
  }, 45_000);
});
