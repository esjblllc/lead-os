import Link from "next/link";

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="RouteIQ"
              className="h-24 w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Login
            </Link>

            <a
              href="#contact"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Request Access
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-gray-200 bg-gradient-to-b from-white to-blue-50/40">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Built for lead buyers, sellers, and brokers
              </div>

              <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                Route every lead to the right buyer at the right price.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                RouteIQ helps you ingest, ping, post, track, and monetize leads
                from one platform. Run direct-post flows, broker supplier
                traffic, monitor delivery outcomes, and understand margin in real
                time.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Log in to RouteIQ
                </Link>

                <a
                  href="#how-it-works"
                  className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500">
                    Routing Modes
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                    Ping / Post
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500">
                    Visibility
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                    Real-Time
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-gray-500">
                    Financial View
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                    Margin First
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-full rounded-[28px] border border-gray-200 bg-white p-6 shadow-xl">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                    Live Workflow
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-sm font-medium text-gray-500">
                        Step 1
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900">
                        Ingest Lead
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Capture from your landing page or receive from a supplier
                        API.
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-sm font-medium text-gray-500">
                        Step 2
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900">
                        Evaluate Buyers
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Apply buyer rules, states, bids, routing logic, and caps.
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-sm font-medium text-gray-500">
                        Step 3
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900">
                        Deliver + Track
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Log delivery status, buyer responses, payout, cost, and
                        margin automatically.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
              Features
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Everything you need to operate a lead distribution business.
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Built for operators who need speed, control, and clean financial
              visibility across campaigns, suppliers, and buyers.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard
              title="Lead Routing"
              description="Run direct-post and ping/post workflows with buyer-specific settings, bid handling, and response validation."
            />
            <FeatureCard
              title="Buyer + Supplier Management"
              description="Configure buyers, suppliers, campaigns, accepted states, pricing, endpoints, and delivery rules from one place."
            />
            <FeatureCard
              title="Performance Reporting"
              description="Analyze leads, revenue, cost, and profit by campaign, buyer, supplier, source, and sub ID."
            />
            <FeatureCard
              title="Accounting Visibility"
              description="Track receivables, payables, and campaign-level margin so you know exactly what traffic is worth."
            />
            <FeatureCard
              title="Logs + Monitoring"
              description="Review ping and delivery outcomes, monitor failures, and audit routing behavior across the platform."
            />
            <FeatureCard
              title="Multi-User Access"
              description="Invite users by organization, manage access, and keep each team sandboxed to its own data."
            />
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-gray-200 bg-gray-50/70"
        >
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                How It Works
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                A cleaner way to manage the full lead lifecycle.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <StepCard
                number="1"
                title="Capture or Receive Leads"
                description="Use RouteIQ behind your own landing pages, or accept brokered supplier traffic through your inbound API."
              />
              <StepCard
                number="2"
                title="Route With Logic"
                description="Match leads to buyers based on vertical, state, endpoint configuration, bid rules, and operational constraints."
              />
              <StepCard
                number="3"
                title="Track Profitability"
                description="See what got sold, what failed, what paid out, and where your best margin is coming from."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-8 rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm lg:grid-cols-[1fr_0.9fr] lg:p-10">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Ideal For
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                Built for performance marketers and lead operators.
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600">
                Whether you generate your own leads, broker supplier traffic, or
                manage buyer relationships across multiple campaigns, RouteIQ is
                designed to help you run the business with more control.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Lead Generators
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-600">
                  Connect your landing pages and deliver traffic to buyers with
                  clean tracking and reporting.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Lead Brokers
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-600">
                  Receive supplier leads, broker them across buyers, and monitor
                  margin in one system.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Buyer Networks
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-600">
                  Standardize specs, endpoints, bid rules, and routing logic
                  across campaigns and partners.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Operations Teams
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-600">
                  Give internal users access to the data they need without
                  leaking data across organizations.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="border-t border-gray-200 bg-blue-600">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                  Get Started
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                  Want to see RouteIQ in action?
                </h2>
                <p className="mt-4 text-base leading-7 text-blue-100">
                  Log in to your workspace or reach out to set up your first
                  routing workflow.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="rounded-2xl border border-white bg-white px-6 py-3 text-sm font-medium text-blue-700"
                >
                  Login
                </Link>

                <a
                  href="mailto:hello@routeiq.pro"
                  className="rounded-2xl border border-blue-200 bg-transparent px-6 py-3 text-sm font-medium text-white"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}