"use client";

import { useEffect, useState } from "react";

type Click = {
  id: string;
  clickId: string;
  trafficSource?: string | null;
  publisherId?: string | null;
  subId?: string | null;
  cost?: number | null;
  ipAddress?: string | null;
  createdAt: string;
  trackingCampaign?: {
    name: string;
  };
  trackingLink?: {
    name: string;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function TrackingClicksPage() {
  const [clicks, setClicks] = useState<Click[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchClicks() {
    try {
      const res = await fetch("/api/tracking-clicks", {
        cache: "no-store",
      });

      const json = await res.json();
      setClicks(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClicks();
  }, []);

  if (loading) {
    return <div className="p-6">Loading clicks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Click Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time click tracking across all campaigns
        </p>
      </div>

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Click ID</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Link</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Publisher</th>
              <th className="px-4 py-3">Sub ID</th>
              <th className="px-4 py-3">CPC</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>

          <tbody>
            {clicks.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  No clicks yet
                </td>
              </tr>
            ) : (
              clicks.map((click) => (
                <tr key={click.id} className="border-t">
                  <td className="px-4 py-3">
                    {formatDate(click.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {click.clickId}
                  </td>
                  <td className="px-4 py-3">
                    {click.trackingCampaign?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {click.trackingLink?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {click.trafficSource || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {click.publisherId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {click.subId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {click.cost ? `$${click.cost}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {click.ipAddress || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}