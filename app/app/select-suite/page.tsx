import Link from "next/link";

export default function SelectSuitePage() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Select Suite</h1>
      <p>Choose which part of RouteIQ you want to use.</p>

      <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
        <Link
          href="/lead"
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Lead Tracking Suite
        </Link>

        <Link
          href="/tracking"
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Link Tracking Suite
        </Link>
      </div>
    </div>
  );
}