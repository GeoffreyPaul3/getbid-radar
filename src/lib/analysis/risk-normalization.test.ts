import { describe, expect, it } from "vitest";
import { normalizeRisk, normalizeRisks, safeText, safeTextList } from "./risk-normalization";

describe("risk-normalization", () => {
  describe("normalizeRisk", () => {
    it("handles standard structured risk objects with title, severity, detail", () => {
      const input = {
        title: "Aggressive timeline",
        severity: "high",
        detail: "Tender requires delivery within 30 calendar days.",
      };

      const result = normalizeRisk(input);
      expect(result).toEqual({
        title: "Aggressive timeline",
        severity: "high",
        detail: "Tender requires delivery within 30 calendar days.",
      });
    });

    it("handles legacy string risk items", () => {
      const input = "Potential currency fluctuation exposure";
      const result = normalizeRisk(input);
      expect(result).toEqual({
        title: "Potential currency fluctuation exposure",
        severity: "medium",
        detail: "",
      });
    });

    it("handles object with missing detail gracefully", () => {
      const input = {
        title: "Subcontractor availability constraint",
        severity: "low",
      };
      const result = normalizeRisk(input);
      expect(result).toEqual({
        title: "Subcontractor availability constraint",
        severity: "low",
        detail: "",
      });
    });

    it("handles object with alternate key names like name and description", () => {
      const input = {
        name: "Key personnel retention",
        description: "Lead architect must remain assigned for 12 months.",
        level: "critical",
      };
      const result = normalizeRisk(input);
      expect(result).toEqual({
        title: "Key personnel retention",
        severity: "high",
        detail: "Lead architect must remain assigned for 12 months.",
      });
    });

    it("handles null or undefined input gracefully without throwing", () => {
      expect(normalizeRisk(null)).toEqual({
        title: "Unspecified risk",
        severity: "medium",
        detail: "",
      });
      expect(normalizeRisk(undefined)).toEqual({
        title: "Unspecified risk",
        severity: "medium",
        detail: "",
      });
    });
  });

  describe("normalizeRisks", () => {
    it("normalizes an array of mixed risk types", () => {
      const inputs = [
        { title: "Risk 1", severity: "high", detail: "Detail 1" },
        "Risk 2 plain string",
        { name: "Risk 3", description: "Detail 3", severity: "low" },
      ];

      const results = normalizeRisks(inputs);
      expect(results).toHaveLength(3);
      expect(results[0]?.severity).toBe("high");
      expect(results[1]?.severity).toBe("medium");
      expect(results[2]?.severity).toBe("low");
    });

    it("returns empty array for non-array or null input", () => {
      expect(normalizeRisks(null)).toEqual([]);
      expect(normalizeRisks(undefined)).toEqual([]);
      expect(normalizeRisks("not-an-array")).toEqual([]);
    });
  });

  describe("safeText and safeTextList", () => {
    it("returns plain strings unchanged", () => {
      expect(safeText("Active ISO 9001")).toBe("Active ISO 9001");
    });

    it("extracts text/title from an object instead of returning [object Object]", () => {
      expect(safeText({ title: "Important blocker" })).toBe("Important blocker");
      expect(safeText({ text: "Important text" })).toBe("Important text");
      expect(safeText({ description: "Important description" })).toBe("Important description");
    });

    it("handles arrays safely with safeTextList", () => {
      const list = ["Item 1", { title: "Item 2" }, 42];
      expect(safeTextList(list)).toEqual(["Item 1", "Item 2", "42"]);
      expect(safeTextList(null)).toEqual([]);
    });
  });
});
