import { flavorTopic } from "../../src/customer-model.js";

export function validateEvent(value, now = Date.now()) {
  if (!value || typeof value.id !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(value.id) || !Number.isFinite(value.at) || value.at > now + 30000 || now - value.at > 5 * 60000) throw new Error("Invalid or expired event");
  if (value.kind === "flavor" && typeof value.flavorId === "string" && value.flavorId.length > 0 && value.flavorId.length <= 100 && typeof value.name === "string" && value.name.trim() && value.name.length <= 100) return { kind: "flavor", id: value.id, at: value.at, flavorId: value.flavorId, name: value.name.trim() };
  if (value.kind === "announcement" && typeof value.message === "string" && value.message.trim() && value.message.length <= 100) return { kind: "announcement", id: value.id, at: value.at, message: value.message.trim() };
  throw new Error("Invalid event");
}

export function buildMessage(event) {
  const isFlavor = event.kind === "flavor";
  return {
    // A single OR condition prevents duplicates for people following both categories.
    ...(isFlavor ? { condition: `'new-flavors' in topics || '${flavorTopic(event.flavorId)}' in topics` } : { topic: "shop-announcements" }),
    notification: { title: "Janarty’s", body: isFlavor ? `${event.name} is in the freezer!` : event.message },
    data: { eventId: event.id, kind: event.kind, ...(isFlavor ? { flavorId: event.flavorId } : {}) },
    apns: {
      headers: { "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor((event.at + 30 * 60000) / 1000)), "apns-collapse-id": event.id },
      payload: { aps: { sound: "default" } },
    },
  };
}
