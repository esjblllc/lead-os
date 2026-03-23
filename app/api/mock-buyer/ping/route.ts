export async function POST(req: Request) {
  try {
    const body = await req.json();

    const state = body?.state || "";
    const zip = body?.zip || "";
    const mode = body?.mockMode || "standard_accept";

    if (!state || !zip) {
      return Response.json(
        {
          accepted: false,
          status: "rejected",
          reason: "Missing state or zip",
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
          reason: "Rejected by mock ping rule",
          payout: 0,
        },
        { status: 200 }
      );
    }

    if (mode === "custom_status") {
      return Response.json(
        {
          status: "accepted",
          payout: 27.5,
          message: "Accepted via custom status mapping",
        },
        { status: 200 }
      );
    }

    if (mode === "nested") {
      return Response.json(
        {
          result: {
            decision: "approved",
            price: 31.25,
          },
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        accepted: true,
        status: "accepted",
        bid: 25.0,
        payout: 25.0,
        buyer: "Mock Buyer",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock buyer ping error:", error);

    return Response.json(
      {
        accepted: false,
        status: "error",
        reason: "Invalid ping payload",
        payout: 0,
      },
      { status: 200 }
    );
  }
}