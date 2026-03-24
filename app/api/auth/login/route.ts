import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(username);

    const res = NextResponse.json({ success: true });

    res.cookies.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}