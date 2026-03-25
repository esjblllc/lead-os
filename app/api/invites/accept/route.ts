import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isInviteExpired } from "@/lib/invites";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return Response.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const invite = await db.invite.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invite) {
      return Response.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return Response.json(
        { error: "Invite is no longer available" },
        { status: 400 }
      );
    }

    if (isInviteExpired(invite.expiresAt)) {
      return Response.json(
        { error: "Invite has expired" },
        { status: 400 }
      );
    }

    return Response.json({
      data: {
        email: invite.email,
        role: invite.role,
        organization: invite.organization,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
    });
  } catch (error) {
    console.error("Invite validate GET error:", error);
    return Response.json(
      { error: "Failed to validate invite" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return Response.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    const invite = await db.invite.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invite) {
      return Response.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return Response.json(
        { error: "Invite is no longer available" },
        { status: 400 }
      );
    }

    if (isInviteExpired(invite.expiresAt)) {
      return Response.json(
        { error: "Invite has expired" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      return Response.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        organizationId: invite.organizationId,
        email: invite.email,
        passwordHash,
        role: invite.role,
        status: "active",
      },
    });

    await db.invite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    return Response.json({
      data: {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error("Invite accept POST error:", error);
    return Response.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}