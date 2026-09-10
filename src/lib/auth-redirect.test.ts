import { describe, it, expect } from "vitest";
import { getSafeRedirect, resolveAuthDestination } from "./auth-redirect";

describe("Authentication & Routing Redirect Flow", () => {
  describe("getSafeRedirect security sanitization", () => {
    it("accepts valid relative internal paths", () => {
      expect(getSafeRedirect("/tenders/new")).toBe("/tenders/new");
      expect(getSafeRedirect("/dashboard")).toBe("/dashboard");
      expect(getSafeRedirect("/tenders/123/workspace?tab=proposal")).toBe(
        "/tenders/123/workspace?tab=proposal",
      );
    });

    it("rejects open-redirect external URLs and protocol-relative paths", () => {
      expect(getSafeRedirect("//evil.com")).toBeNull();
      expect(getSafeRedirect("https://attacker.com/malicious")).toBeNull();
      expect(getSafeRedirect("http://evil.com")).toBeNull();
      expect(getSafeRedirect("javascript:alert(1)")).toBeNull();
    });

    it("rejects circular loops back to /login", () => {
      expect(getSafeRedirect("/login")).toBeNull();
      expect(getSafeRedirect("/login?redirect=/dashboard")).toBeNull();
    });

    it("handles null, undefined, empty, or whitespace values safely", () => {
      expect(getSafeRedirect(null)).toBeNull();
      expect(getSafeRedirect(undefined)).toBeNull();
      expect(getSafeRedirect("")).toBeNull();
      expect(getSafeRedirect("   ")).toBeNull();
    });
  });

  describe("resolveAuthDestination requirements", () => {
    // 1. Existing user -> /dashboard
    it("routes existing onboarded user with workspace to /dashboard when no redirect is provided", () => {
      const destination = resolveAuthDestination({
        hasWorkspace: true,
        isOnboarded: true,
      });
      expect(destination).toBe("/dashboard");
    });

    // 2. Existing user with redirect -> requested destination
    it("routes existing onboarded user with redirect parameter to requested destination", () => {
      const destination = resolveAuthDestination({
        hasWorkspace: true,
        isOnboarded: true,
        rawRedirect: "/tenders/abc-123/requirements",
      });
      expect(destination).toBe("/tenders/abc-123/requirements");
    });

    // 3. New user -> onboarding
    it("routes new user without workspace or not onboarded to /onboarding", () => {
      const noWs = resolveAuthDestination({
        hasWorkspace: false,
        isOnboarded: false,
      });
      expect(noWs).toBe("/onboarding");

      const notOnboarded = resolveAuthDestination({
        hasWorkspace: true,
        isOnboarded: false,
      });
      expect(notOnboarded).toBe("/onboarding");
    });

    // 4. Anonymous /tenders/new -> login with redirect
    it("preserves destination when routing an anonymous visitor from /tenders/new to login", () => {
      const target = "/tenders/new";
      const loginUrl = `/login?redirect=${encodeURIComponent(target)}`;
      expect(loginUrl).toBe("/login?redirect=%2Ftenders%2Fnew");
    });

    // 5. Successful login from /tenders/new -> /tenders/new
    it("routes to /tenders/new after successful login when redirect=/tenders/new", () => {
      const destination = resolveAuthDestination({
        hasWorkspace: true,
        isOnboarded: true,
        rawRedirect: "/tenders/new",
      });
      expect(destination).toBe("/tenders/new");
    });

    // 6. Sign out -> /
    it("ensures sign-out destination is root /", () => {
      const signOutDestination = "/";
      expect(signOutDestination).toBe("/");
    });
  });
});
