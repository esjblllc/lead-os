export async function POST(req: Request) {
  try {
    const body = await req.json();

    const state = body?.state || "";
    const zip = body?.zip || "";

    if (!state || !zip) {
      return Response.json(
        {
          status: "rejected",
          payout: 0,
          reason: "Missing state or zip",
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        status: "accepted",
        payout: 27.5,
        message: "Accepted via custom status route",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock buyer ping custom-status error:", error);

    return Response.json(
      {
        status: "error",
        payout: 0,
        reason: "Invalid ping payload",
      },
      { status: 200 }
    );
  }
}