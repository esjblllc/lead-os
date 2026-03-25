import crypto from "node:crypto";

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getInviteExpiryDate(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}