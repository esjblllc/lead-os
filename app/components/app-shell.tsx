"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "./nav-links";

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
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
          Local environment
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

            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
              Ethan Levy
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}