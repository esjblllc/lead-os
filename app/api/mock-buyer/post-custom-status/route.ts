export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = body?.firstName || "";
    const email = body?.email || "";
    const phone = body?.phone || "";

    if (!firstName || !email || !phone) {
      return Response.json(
        {
          status: "rejected",
          payout: 0,
          reason: "Missing required fields",
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        status: "accepted",
        payout: 42.5,
        lead_id: `mock_${Date.now()}`,
        note: "Accepted via custom status route",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock buyer post custom-status error:", error);

    return Response.json(
      {
        status: "error",
        payout: 0,
        reason: "Invalid post payload",
      },
      { status: 200 }
    );
  }
}