"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(path));

  const linkClass = (path: string) =>
    `group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all ${
      isActive(path)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Link href="/" className={linkClass("/")}>
        Dashboard
      </Link>

      <Link href="/buyers" className={linkClass("/buyers")}>
        Buyers
      </Link>

      <Link href="/buyer-specs" className={linkClass("/buyer-specs")}>
        Buyer Specs
      </Link>

      <Link href="/suppliers" className={linkClass("/suppliers")}>
        Suppliers
      </Link>

      <Link href="/campaigns" className={linkClass("/campaigns")}>
        Campaigns
      </Link>

      <Link href="/leads" className={linkClass("/leads")}>
        Leads
      </Link>

      <Link href="/deliveries" className={linkClass("/deliveries")}>
        Deliveries
      </Link>

      <Link href="/performance" className={linkClass("/performance")}>
        Reports
      </Link>

      <Link href="/logs" className={linkClass("/logs")}>
        Logs
      </Link>

      <Link href="/monitoring" className={linkClass("/monitoring")}>
        Monitoring
      </Link>

      <Link href="/accounting" className={linkClass("/accounting")}>
        Accounting
      </Link>

      <Link href="/inbound" className={linkClass("/inbound")}>
        Inbound Specs
      </Link>

      <button
        onClick={handleLogout}
        className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        Logout
      </button>
    </div>
  );
}