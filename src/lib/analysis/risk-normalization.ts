export type RiskSeverity = "low" | "medium" | "high";

export interface NormalizedRisk {
  title: string;
  severity: RiskSeverity;
  detail: string;
}

/**
 * Normalizes an arbitrary risk entry into a safe, strongly-typed NormalizedRisk object.
 * Handles:
 * - Structured AI output: { title: string, severity: 'low' | 'medium' | 'high', detail: string }
 * - Alternative object shapes: { name, description }, { text, level }, etc.
 * - Plain string entries: "Risk description"
 * - Malformed / unexpected primitives
 */
export function normalizeRisk(item: unknown): NormalizedRisk {
  if (typeof item === "string") {
    const trimmed = item.trim();
    return {
      title: trimmed || "Unspecified risk",
      severity: "medium",
      detail: "",
    };
  }

  if (typeof item === "object" && item !== null) {
    const rec = item as Record<string, unknown>;

    const recTitle = rec["title"];
    const recName = rec["name"];
    const recText = rec["text"];
    const titleCandidate =
      typeof recTitle === "string"
        ? recTitle.trim()
        : typeof recName === "string"
          ? recName.trim()
          : typeof recText === "string"
            ? recText.trim()
            : "";

    const recDetail = rec["detail"];
    const recDesc = rec["description"];
    const recRationale = rec["rationale"];
    const detailCandidate =
      typeof recDetail === "string"
        ? recDetail.trim()
        : typeof recDesc === "string"
          ? recDesc.trim()
          : typeof recRationale === "string"
            ? recRationale.trim()
            : "";

    const recSeverity = rec["severity"];
    const recLevel = rec["level"];
    const severityRaw =
      typeof recSeverity === "string"
        ? recSeverity.trim().toLowerCase()
        : typeof recLevel === "string"
          ? recLevel.trim().toLowerCase()
          : "medium";

    const severity: RiskSeverity =
      severityRaw === "high" || severityRaw === "critical"
        ? "high"
        : severityRaw === "low"
          ? "low"
          : "medium";

    const title = titleCandidate || detailCandidate || "Unspecified risk";
    const detail =
      titleCandidate && detailCandidate && titleCandidate !== detailCandidate
        ? detailCandidate
        : "";

    return {
      title,
      severity,
      detail,
    };
  }

  return {
    title: String(item ?? "Unspecified risk"),
    severity: "medium",
    detail: "",
  };
}

/**
 * Normalizes an array of arbitrary risk entries.
 */
export function normalizeRisks(risks: unknown): NormalizedRisk[] {
  if (!Array.isArray(risks)) return [];
  return risks.map(normalizeRisk);
}

/**
 * Ensures that an arbitrary value is formatted as a safe string child for React rendering.
 * Prevents "Objects are not valid as a React child" errors if an object is mistakenly passed.
 */
export function safeText(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (typeof item === "object" && item !== null) {
    const rec = item as Record<string, unknown>;
    const title = rec["title"];
    if (typeof title === "string" && title) return title;
    const text = rec["text"];
    if (typeof text === "string" && text) return text;
    const desc = rec["description"];
    if (typeof desc === "string" && desc) return desc;
    const detail = rec["detail"];
    if (typeof detail === "string" && detail) return detail;
    const name = rec["name"];
    if (typeof name === "string" && name) return name;
    return JSON.stringify(item);
  }
  return String(item ?? "");
}

/**
 * Normalizes an array of items into an array of safe strings.
 */
export function safeTextList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map(safeText);
}
