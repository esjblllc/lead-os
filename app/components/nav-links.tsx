"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function NavLinks() {
  const pathname = usePathname();
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
        console.error("Failed to load nav session user:", error);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const isActive = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(path));

  const linkClass = (path: string) =>
    `group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all ${
      isActive(path)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  const canManageUsers =
    user?.role === "platform_admin" || user?.role === "admin";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/dashboard";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Link href="/dashboard" className={linkClass("/")}>
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

      {canManageUsers ? (
        <>
          <Link href="/users" className={linkClass("/users")}>
            Users
          </Link>

          <Link href="/invites" className={linkClass("/invites")}>
            Invites
          </Link>
        </>
      ) : null}

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