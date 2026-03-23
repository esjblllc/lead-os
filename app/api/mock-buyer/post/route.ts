export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = body?.firstName || "";
    const email = body?.email || "";
    const phone = body?.phone || "";
    const mode = body?.mockMode || "standard_accept";

    if (!firstName || !email || !phone) {
      return Response.json(
        {
          accepted: false,
          status: "rejected",
          reason: "Missing required fields",
          payout: 0,
        },
        { status: 200 }
      );
    }

    if (mode === "reject") {
      return Response.json(
        {
          accepted: false,
          status: "rejected",
          reason: "Rejected by mock post rule",
          payout: 0,
        },
        { status: 200 }
      );
    }

    if (mode === "custom_status") {
      return Response.json(
        {
          status: "accepted",
          payout: 42.5,
          lead_id: `mock_${Date.now()}`,
          note: "Accepted via custom status mapping",
        },
        { status: 200 }
      );
    }

    if (mode === "nested") {
      return Response.json(
        {
          result: {
            decision: "approved",
            amount: 55.75,
          },
          lead_id: `mock_${Date.now()}`,
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        accepted: true,
        status: "accepted",
        lead_id: `mock_${Date.now()}`,
        payout: 25.0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock buyer post error:", error);

    return Response.json(
      {
        accepted: false,
        status: "error",
        reason: "Invalid post payload",
        payout: 0,
      },
      { status: 200 }
    );
  }
}