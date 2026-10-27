import test from "node:test";
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyStaff } from "../src/staff-auth.js";
import { STAFF_IDENTITIES } from "../../push-relay/src/staff-identities.js";

test("Instagram's own jose verifies the shared staff policy with signed Firebase tokens", async t => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "instagram-test", alg: "RS256" };
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    return Response.json({ keys: [jwk] });
  });
  const request = async (claims, audience = "janarty-s", expiry = "5m") => {
    const token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "instagram-test" })
      .setIssuer("https://securetoken.google.com/janarty-s").setAudience(audience)
      .setIssuedAt().setExpirationTime(expiry).sign(privateKey);
    return new Request("https://feed.test/connect/start", { headers: { Authorization: `Bearer ${token}` } });
  };
  for (const [uid, email] of STAFF_IDENTITIES) {
    const claims = { sub: uid, email, email_verified: true };
    assert.equal(await verifyStaff(await request(claims), "janarty-s"), uid);
    for (const invalid of [
      { ...claims, sub: "replacement-account" }, { ...claims, email: "outsider@example.com" },
      { ...claims, email: STAFF_IDENTITIES.find(pair => pair[0] !== uid)[1] },
      { ...claims, email_verified: false },
    ]) await assert.rejects(verifyStaff(await request(invalid), "janarty-s"));
    await assert.rejects(verifyStaff(await request(claims, "wrong-project"), "janarty-s"));
    await assert.rejects(verifyStaff(await request(claims, "janarty-s", "-1m"), "janarty-s"));
  }
  await assert.rejects(verifyStaff(new Request("https://feed.test/connect/start"), "janarty-s"));
});
