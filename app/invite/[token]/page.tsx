"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InviteData = {
  email: string;
  role: string;
  organization: {
    id: string;
    name: string;
  };
  expiresAt: string;
  status: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token || "");

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadInvite() {
      try {
        const res = await fetch(`/api/invites/accept?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Invalid invite");
        }

        if (mounted) {
          setInvite(json.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Invalid invite");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadInvite();
    } else {
      setError("Missing invite token");
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);

      // STEP 1 — accept invite
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to accept invite");
      }

      const email = json?.email || invite?.email;

      // STEP 2 — auto login
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!loginRes.ok) {
        throw new Error("Account created, but login failed");
      }

      setSuccess("Account created. Logging you in...");

      // STEP 3 — redirect into app
      setTimeout(() => {
        router.push("/");
      }, 800);

    } catch (err: any) {
      setError(err?.message || "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading invite...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          Invite
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Accept Invite
        </h1>

        {invite ? (
          <>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm">
              <div>
                <span className="font-medium">Email:</span> {invite.email}
              </div>
              <div className="mt-2">
                <span className="font-medium">Organization:</span>{" "}
                {invite.organization?.name || "—"}
              </div>
              <div className="mt-2">
                <span className="font-medium">Role:</span> {invite.role}
              </div>
              <div className="mt-2">
                <span className="font-medium">Expires:</span>{" "}
                {formatDate(invite.expiresAt)}
              </div>
            </div>

            <form onSubmit={handleAccept} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Create your password"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Re-enter your password"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Creating Account..." : "Accept Invite"}
              </button>
            </form>
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Invite not found"}
          </div>
        )}
      </div>
    </div>
  );
}