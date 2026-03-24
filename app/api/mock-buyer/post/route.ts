export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = body?.firstName || "";
    const email = body?.email || "";
    const phone = body?.phone || "";

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