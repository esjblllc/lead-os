import { getCurrentUser } from "@/lib/session-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ data: null }, { status: 401 });
    }

    return Response.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization
          ? {
              id: user.organization.id,
              name: user.organization.name,
            }
          : null,
        allowedSuites: ["lead", "tracking"],
        preferredSuite: null,
      },
    });
  } catch (error) {
    console.error("Session me GET error:", error);

    return Response.json(
      { error: "Failed to load session user" },
      { status: 500 }
    );
  }
}