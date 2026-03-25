import { db } from "@/lib/db";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export type RequestSessionUser = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  };
};

export async function getRequestSessionUser(req: Request): Promise<RequestSessionUser | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieName = getSessionCookieName();

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  const token = match ? decodeURIComponent(match.split("=")[1]) : undefined;
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

export function isPlatformAdmin(user: RequestSessionUser) {
  return user.role === "platform_admin";
}