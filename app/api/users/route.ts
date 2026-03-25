import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  getRequestSessionUser,
  isPlatformAdmin,
} from "@/lib/request-session-user";

export async function GET(req: Request) {
  try {
    const sessionUser = await getRequestSessionUser(req);

    if (!sessionUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await db.user.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : {
            organizationId: sessionUser.organizationId,
          },
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
      },
    });

    const organizations = await db.organization.findMany({
      where: isPlatformAdmin(sessionUser)
        ? undefined
        : {
            id: sessionUser.organizationId,
          },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      data: users,
      organizations,
    });
  } catch (error) {
    console.error("Users GET error:", error);
    return Response.json(
      { error: "Failed to fetch users" },
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

    const body = await req.json();
    const { email, password, role, status, organizationId, organizationName } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
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

    let targetOrganizationId = sessionUser.organizationId;
    let targetRole = "member";

    if (isPlatformAdmin(sessionUser)) {
      targetRole = role || "admin";

      if (organizationId) {
        targetOrganizationId = organizationId;
      } else if (organizationName) {
        const existingOrg = await db.organization.findFirst({
          where: { name: organizationName },
        });

        if (existingOrg) {
          targetOrganizationId = existingOrg.id;
        } else {
          const createdOrg = await db.organization.create({
            data: { name: organizationName },
          });
          targetOrganizationId = createdOrg.id;
        }
      }
    } else {
      targetRole = "member";
      targetOrganizationId = sessionUser.organizationId;
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: targetRole,
        status: status || "active",
        organizationId: targetOrganizationId,
      },
      include: {
        organization: true,
      },
    });

    return Response.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error("Users POST error:", error);
    return Response.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}