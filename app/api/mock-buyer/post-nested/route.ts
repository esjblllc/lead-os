export async function POST(req: Request) {
  try {
    const body = await req.json();

    const firstName = body?.firstName || "";
    const email = body?.email || "";
    const phone = body?.phone || "";

    if (!firstName || !email || !phone) {
      return Response.json(
        {
          result: {
            decision: "rejected",
            amount: 0,
            reason: "Missing required fields",
          },
          lead_id: `mock_${Date.now()}`,
        },
        { status: 200 }
      );
    }

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
  } catch (error) {
    console.error("Mock buyer post nested error:", error);

    return Response.json(
      {
        result: {
          decision: "error",
          amount: 0,
          reason: "Invalid post payload",
        },
        lead_id: `mock_${Date.now()}`,
      },
      { status: 200 }
    );
  }
}