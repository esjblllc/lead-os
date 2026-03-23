export async function POST(req: Request) {
  try {
    const body = await req.json();

    const state = body?.state || "";
    const zip = body?.zip || "";

    if (!state || !zip) {
      return Response.json(
        {
          result: {
            decision: "rejected",
            price: 0,
            reason: "Missing state or zip",
          },
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        result: {
          decision: "approved",
          price: 31.25,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock buyer ping nested error:", error);

    return Response.json(
      {
        result: {
          decision: "error",
          price: 0,
          reason: "Invalid ping payload",
        },
      },
      { status: 200 }
    );
  }
}