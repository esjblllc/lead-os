import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
      },
    });

    const organizations = await db.organization.findMany({
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
    const body = await req.json();

    const {
      email,
      password,
      role,
      status,
      organizationId,
      organizationName,
    } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let orgId = organizationId;

    if (!orgId) {
      if (!organizationName) {
        return Response.json(
          { error: "organizationId or organizationName is required" },
          { status: 400 }
        );
      }

      const existingOrg = await db.organization.findFirst({
        where: { name: organizationName },
      });

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const createdOrg = await db.organization.create({
          data: { name: organizationName },
        });

        orgId = createdOrg.id;
      }
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

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: role || "admin",
        status: status || "active",
        organizationId: orgId,
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