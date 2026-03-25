import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  };
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  const session = await verifySessionToken(token);
  if (!session?.username) return null;

  const user = await db.user.findFirst({
    where: {
      email: session.username,
      status: "active",
    },
    include: {
      organization: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
    },
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function isPlatformAdmin(user: SessionUser) {
  return user.role === "platform_admin";
}

export function buildOrgWhere<T extends Record<string, any>>(
  user: SessionUser,
  extra?: T
) {
  if (isPlatformAdmin(user)) {
    return {
      ...(extra || {}),
    };
  }

  return {
    organizationId: user.organizationId,
    ...(extra || {}),
  };
}