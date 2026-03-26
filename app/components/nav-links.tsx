"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

type NavItem = {
  label: string;
  href: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
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

  const isTrackingSuite =
    pathname === "/tracking" || pathname.startsWith("/tracking/");
  const canManageUsers =
    user?.role === "platform_admin" || user?.role === "admin";

  const isActive = (path: string) =>
    pathname === path ||
    (path !== "/dashboard" &&
      path !== "/tracking" &&
      pathname.startsWith(path));

  const linkClass = (path: string) =>
    `group flex min-h-[44px] items-center rounded-xl px-4 py-3 text-sm font-medium transition-all ${
      isActive(path)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  const sectionLabelClass =
    "px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400";

  const leadSections: NavSection[] = [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Reports", href: "/performance" },
        { label: "Variance", href: "/performance/variance" },
        { label: "Accounting", href: "/accounting" },
        { label: "Logs", href: "/logs" },
        { label: "Monitoring", href: "/monitoring" },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Buyers", href: "/buyers" },
        { label: "Buyer Specs", href: "/buyer-specs" },
        { label: "Suppliers", href: "/suppliers" },
        { label: "Campaigns", href: "/campaigns" },
        { label: "Leads", href: "/leads" },
        { label: "Deliveries", href: "/deliveries" },
        { label: "Inbound Specs", href: "/inbound" },
      ],
    },
  ];

  const trackingSections: NavSection[] = [
    {
      title: "Overview",
      items: [{ label: "Tracking Dashboard", href: "/tracking" }],
    },
    {
      title: "Setup",
      items: [
        { label: "Tracking Campaigns", href: "/tracking/campaigns" },
        { label: "Tracking Links", href: "/tracking/links" },
      ],
    },
    {
      title: "Analysis",
      items: [
        { label: "Click Logs", href: "/tracking/clicks" },
        { label: "Tracking Reports", href: "/tracking/reports" },
        { label: "Tracking Variance", href: "/tracking/reports/variance" },
      ],
    },
  ];

  const accessSection: NavSection | null = canManageUsers
    ? {
        title: "Access",
        items: [
          { label: "Users", href: "/users" },
          { label: "Invites", href: "/invites" },
        ],
      }
    : null;

  const sections = useMemo(() => {
    const baseSections = isTrackingSuite ? trackingSections : leadSections;
    return accessSection ? [...baseSections, accessSection] : baseSections;
  }, [isTrackingSuite, accessSection]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/select-suite"
        className="mb-2 flex min-h-[44px] items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Switch Suite
      </Link>

      {sections.map((section) => (
        <div key={section.title}>
          <div className={sectionLabelClass}>{section.title}</div>

          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      <button
        onClick={handleLogout}
        className="mt-5 min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        Logout
      </button>
    </div>
  );
}