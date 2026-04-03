import Link from "next/link";

export default function TrackingSuitePage() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Link Tracking Suite</h1>
      <p>This is your tracking dashboard.</p>

      <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
        <Link
          href="/tracking/campaigns"
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Tracking Campaigns
        </Link>

        <Link
          href="/tracking/links"
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Tracking Links
        </Link>

        <Link
          href="/tracking/reports"
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Tracking Reports
        </Link>
      </div>
    </div>
  );
}
