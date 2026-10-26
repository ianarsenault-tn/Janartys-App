import { createRemoteJWKSet, jwtVerify } from "jose";
import { STAFF_IDENTITIES } from "./staff-identities.js";

// Shared by the push relay and Instagram connection; no client-provided identity.
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/** @param {Request} request @param {string} project */
export async function verifyStaff(request, project) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(authorization.slice(7), keys, { algorithms: ["RS256"], issuer: `https://securetoken.google.com/${project}`, audience: project });
  if (!payload.sub || !STAFF_IDENTITIES.some(([uid, email]) => payload.sub === uid && payload.email === email) || payload.email_verified !== true) throw new Error("Unauthorized");
  return payload.sub;
}
