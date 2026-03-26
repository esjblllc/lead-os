"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "./nav-links";

type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  };
};

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isPublicShellFreePage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/select-suite" ||
    pathname.startsWith("/invite");

  const isTrackingSuite = pathname === "/tracking" || pathname.startsWith("/tracking/");

  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const res = await fetch("/api/session/me", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const json = await res.json();

        if (mounted) {
          setUser(json.data || null);
        }
      } catch (error) {
        console.error("Failed to load session user:", error);
      }
    }

    if (!isPublicShellFreePage) {
      loadUser();
    }

    return () => {
      mounted = false;
    };
  }, [isPublicShellFreePage]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const suiteMeta = useMemo(() => {
    if (isTrackingSuite) {
      return {
        eyebrow: "RouteIQ",
        title: "Link Tracking Suite",
        subtitle: "Campaigns, links, click logs, and traffic reporting",
        headerLabel: "Front-end traffic tracking",
        headerTitle: "Tracking Console",
      };
    }

    return {
      eyebrow: "RouteIQ",
      title: "Lead Tracking Suite",
      subtitle: "Routing, reporting, monitoring, and accounting",
      headerLabel: "Lead management platform",
      headerTitle: "Admin Console",
    };
  }, [isTrackingSuite]);

  if (isPublicShellFreePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <aside className="hidden w-72 shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            {suiteMeta.eyebrow}
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            {suiteMeta.title}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {suiteMeta.subtitle}
          </div>
        </div>

        <div className="flex-1 px-4 py-5">
          <NavLinks />
        </div>

        <div className="border-t border-gray-200 px-6 py-4 text-xs text-gray-400">
          {user?.organization?.name || "Local environment"}
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] transform border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                {suiteMeta.eyebrow}
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                {suiteMeta.title}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {user?.organization?.name || "Workspace"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <NavLinks />
          </div>

          <div className="border-t border-gray-200 px-5 py-4">
            <div className="text-xs text-gray-400">
              {user?.email || "Loading..."}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden"
              >
                Menu
              </button>

              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-500">
                  {suiteMeta.headerLabel}
                </div>
                <div className="truncate text-xl font-semibold tracking-tight text-gray-900">
                  {suiteMeta.headerTitle}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {user?.organization?.name ? (
                <div className="hidden max-w-[220px] truncate rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 md:block">
                  {user.organization.name}
                </div>
              ) : null}

              <div className="max-w-[160px] truncate rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:max-w-[240px] sm:px-4 sm:text-sm">
                {user?.email || "Loading..."}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}