import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { STAFF_EMAILS } from "./data.js";
import { auth } from "./firebase.js";

const allowlist = new Set(
  STAFF_EMAILS.map((email) => String(email).trim().toLowerCase()).filter(Boolean)
);

export function normalizeStaffEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAllowlistedEmail(email) {
  return allowlist.has(normalizeStaffEmail(email));
}

export function currentStaffUser() {
  const user = auth.currentUser;
  if (!user?.email || !isAllowlistedEmail(user.email)) return null;
  return user;
}

export function isStaffSignedIn() {
  return Boolean(currentStaffUser());
}

export function whenAuthReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve(currentStaffUser());
    });
  });
}

export async function signInStaff(email, password) {
  const normalized = normalizeStaffEmail(email);
  if (!normalized || !password) {
    const err = new Error("missing");
    err.code = "staff/missing";
    throw err;
  }
  if (!isAllowlistedEmail(normalized)) {
    const err = new Error("not-staff");
    err.code = "staff/not-allowed";
    throw err;
  }
  const cred = await signInWithEmailAndPassword(auth, normalized, password);
  if (!isAllowlistedEmail(cred.user.email)) {
    await signOut(auth);
    const err = new Error("not-staff");
    err.code = "staff/not-allowed";
    throw err;
  }
  return cred.user;
}

export async function signOutStaff() {
  await signOut(auth);
}

export function staffAuthErrorMessage(err) {
  const code = err?.code || "";
  if (code === "staff/missing") return "Enter your staff email and password.";
  if (code === "staff/not-allowed") return "That email isn’t on the staff list.";
  if (code === "auth/invalid-email") return "Check the email address.";
  if (code === "auth/user-disabled") return "That staff account is disabled.";
  if (code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Email or password didn’t match.";
  }
  if (code === "auth/invalid-credential") return "Email or password didn’t match.";
  if (code === "auth/too-many-requests") {
    return "Too many tries. Pause for a couple of minutes.";
  }
  if (code === "auth/network-request-failed") {
    return "Couldn’t reach Firebase. Check the connection.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/Password isn’t turned on in Firebase yet.";
  }

  return "Couldn’t sign in right now.";
}
