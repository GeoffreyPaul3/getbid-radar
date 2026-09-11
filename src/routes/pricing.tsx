import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /pricing — canonical deep-link to the pricing section.
 *
 * The full pricing content lives on the public homepage at /#pricing.
 * This route prevents a 404 for direct navigation to /pricing and
 * ensures link-sharing, SEO anchors, and marketing links resolve cleanly.
 */
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "pricing", replace: true });
  },
  component: () => null,
});
