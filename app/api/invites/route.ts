import { db } from "@/lib/db";
import { getRequestSessionUser, isPlatformAdmin } from "@/lib/request-session-user";
import { generateInviteToken, getInviteExpiryDate } from "@/lib/invites";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "platform_admin" && sessionUser.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const invites = await db.invite.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { organizationId: sessionUser.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
      },
    });

    const organizations = await db.organization.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : { id: sessionUser.organizationId },
      orderBy: { name: "asc" },
    });

    return Response.json({
      data: invites,
      organizations,
    });
  } catch (error) {
    console.error("Invites GET error:", error);
    return Response.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "platform_admin" && sessionUser.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, role, organizationId, organizationName, expiresInDays } = body;

    if (!email) {
      return Response.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json(
        { error: "A user with that email already exists" },
        { status: 400 }
      );
    }

    const existingPendingInvite = await db.invite.findFirst({
      where: {
        email,
        status: "pending",
      },
    });

    if (existingPendingInvite) {
      return Response.json(
        { error: "A pending invite already exists for that email" },
        { status: 400 }
      );
    }

    let targetOrganizationId = sessionUser.organizationId;
    let targetRole = "member";

    if (isPlatformAdmin(sessionUser)) {
      targetRole = role || "admin";

      if (organizationId) {
        targetOrganizationId = organizationId;
      } else if (organizationName && String(organizationName).trim()) {
        const trimmedName = String(organizationName).trim();

        const existingOrg = await db.organization.findFirst({
          where: { name: trimmedName },
        });

        if (existingOrg) {
          targetOrganizationId = existingOrg.id;
        } else {
          const createdOrg = await db.organization.create({
            data: { name: trimmedName },
          });
          targetOrganizationId = createdOrg.id;
        }
      } else {
        return Response.json(
          { error: "Organization is required" },
          { status: 400 }
        );
      }
    } else {
      targetRole = "member";
      targetOrganizationId = sessionUser.organizationId;
    }

    const invite = await db.invite.create({
      data: {
        organizationId: targetOrganizationId,
        email,
        role: targetRole,
        token: generateInviteToken(),
        status: "pending",
        expiresAt: getInviteExpiryDate(
          typeof expiresInDays === "number" && expiresInDays > 0
            ? expiresInDays
            : 7
        ),
      },
      include: {
        organization: true,
      },
    });

    return Response.json({ data: invite }, { status: 201 });
  } catch (error) {
    console.error("Invites POST error:", error);
    return Response.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}