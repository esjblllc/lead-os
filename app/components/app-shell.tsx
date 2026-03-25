"use client";

import { useEffect, useState } from "react";
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
  const isAuthPage = pathname === "/login";

  const [user, setUser] = useState<SessionUser | null>(null);

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

    if (!isAuthPage) {
      loadUser();
    }

    return () => {
      mounted = false;
    };
  }, [isAuthPage]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Lead OS
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
            Operations
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Routing, reporting, monitoring, and accounting
          </div>
        </div>

        <div className="flex-1 px-4 py-5">
          <NavLinks />
        </div>

        <div className="border-t border-gray-200 px-6 py-4 text-xs text-gray-400">
          {user?.organization?.name || "Local environment"}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <div className="text-sm font-medium text-gray-500">
                Lead management platform
              </div>
              <div className="text-lg font-semibold tracking-tight text-gray-900">
                Admin Console
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.organization?.name ? (
                <div className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 md:block">
                  {user.organization.name}
                </div>
              ) : null}

              <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                {user?.email || "Loading..."}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}