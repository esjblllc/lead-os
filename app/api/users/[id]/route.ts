import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const {
      email,
      password,
      role,
      status,
      organizationId,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof email !== "undefined") updateData.email = email;
    if (typeof role !== "undefined") updateData.role = role;
    if (typeof status !== "undefined") updateData.status = status;
    if (typeof organizationId !== "undefined") {
      updateData.organizationId = organizationId;
    }

    if (typeof password !== "undefined" && password !== "") {
      updateData.passwordHash = await hashPassword(password);
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        organization: true,
      },
    });

    return Response.json({ data: user });
  } catch (error) {
    console.error("User PATCH error:", error);

    return Response.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}