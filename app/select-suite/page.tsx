import Link from "next/link";
import { requireCurrentUser } from "@/lib/session-user";

function SuiteCard({
  eyebrow,
  title,
  description,
  href,
  cta,
  bullets,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  bullets: string[];
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
        {eyebrow}
      </div>

      <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
        {title}
      </h2>

      <p className="mt-4 text-base leading-7 text-gray-600">{description}</p>

      <div className="mt-6 space-y-2">
        {bullets.map((bullet) => (
          <div key={bullet} className="text-sm text-gray-600">
            • {bullet}
          </div>
        ))}
      </div>

      <div className="mt-8 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition group-hover:bg-blue-700">
        {cta}
      </div>
    </Link>
  );
}

export default async function SelectSuitePage() {
  const user = await requireCurrentUser();

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            RouteIQ
          </div>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
            Choose your suite
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
            Welcome back
            {user.organization?.name ? ` to ${user.organization.name}` : ""}.
            RouteIQ is split into two operating environments so you can manage
            top-of-funnel traffic separately from downstream lead routing and monetization.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-500">
            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
              {user.email}
            </div>
            {user.organization?.name ? (
              <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
                {user.organization.name}
              </div>
            ) : null}
            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
              Role: {user.role}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SuiteCard
            eyebrow="Traffic"
            title="Link Tracking Suite"
            description="Track clicks, traffic sources, subIDs, CPC, spend, and attribution across your front-end media buying stack."
            href="/tracking"
            cta="Open Link Tracking"
            bullets={[
              "Tracking campaigns and links",
              "Click logging and redirect tracking",
              "Traffic source and subID reporting",
              "Spend and CPC visibility",
            ]}
          />

          <SuiteCard
            eyebrow="Monetization"
            title="Lead Tracking Suite"
            description="Manage buyers, suppliers, campaigns, lead routing, ping/post delivery, performance reporting, and accounting."
            href="/dashboard"
            cta="Open Lead Tracking"
            bullets={[
              "Buyer and supplier management",
              "Lead ingestion and routing",
              "Ping/post delivery logging",
              "Revenue, cost, profit, and margin reporting",
            ]}
          />
        </div>
      </div>
    </div>
  );
}