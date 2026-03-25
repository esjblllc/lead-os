import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "platform_admin" && sessionUser.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (
      !isPlatformAdmin(sessionUser) &&
      targetUser.organizationId !== sessionUser.organizationId
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.email !== "undefined") {
      updateData.email = body.email;
    }

    if (typeof body.status !== "undefined") {
      updateData.status = body.status;
    }

    if (typeof body.password !== "undefined" && body.password !== "") {
      updateData.passwordHash = await hashPassword(body.password);
    }

    if (isPlatformAdmin(sessionUser)) {
      if (typeof body.role !== "undefined") {
        updateData.role = body.role;
      }

      if (typeof body.organizationId !== "undefined") {
        updateData.organizationId = body.organizationId;
      }
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