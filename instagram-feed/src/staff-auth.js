import { createRemoteJWKSet, jwtVerify } from "jose";
import { createStaffVerifier } from "../../shared/staff-auth.js";

export const verifyStaff = createStaffVerifier({ createRemoteJWKSet, jwtVerify });
