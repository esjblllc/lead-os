export type AppSuite = "lead" | "tracking";

export const SUITES: {
  key: AppSuite;
  name: string;
  description: string;
  href: string;
}[] = [
  {
    key: "lead",
    name: "RouteIQ Lead Suite",
    description:
      "Lead intake, routing, buyers, reporting, accounting, and ops.",
    href: "/app/lead",
  },
  {
    key: "tracking",
    name: "RouteIQ Tracking Suite",
    description:
      "Traffic sources, campaigns, tracking links, clicks, conversions, and spend.",
    href: "/app/tracking",
  },
];