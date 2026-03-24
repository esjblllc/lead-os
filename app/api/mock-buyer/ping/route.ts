export async function POST(req: Request) {
  try {
    const body = await req.json();

    const state = body?.state || "";
    const zip = body?.zip || "";
    const subId = body?.subId || "";

    if (!state || !zip) {
      return Response.json(
        {
          accepted: false,
          status: "rejected",
          bid: 0,
          reason: "Missing state or zip",
        },
        { status: 200 }
      );
    }

    let bid = 25;

    if (subId === "high_bid") {
      bid = 40;
    } else if (subId === "low_bid") {
      bid = 15;
    } else if (zip.startsWith("9")) {
      bid = 30;
    }

    return Response.json(
      {
        accepted: true,
        status: "accepted",
        bid,
        payout: bid,
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
        bid: 0,
        reason: "Invalid ping payload",
      },
      { status: 200 }
    );
  }
}