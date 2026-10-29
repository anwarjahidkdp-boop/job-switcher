import { describe, expect, it } from "vitest";
import { pushMessage, safeLink, validSubscription } from "./push";
import { pushState } from "../pwa/push";

describe("phone alerts", () => {
  it("one new notification shows as itself", () => {
    expect(pushMessage([{ kind: "match", title: "New 82% match: Accounts Manager", body: "ACME · Dhaka. Want us to prepare your application?", link: "/jobs/9" }]))
      .toEqual({ title: "New 82% match: Accounts Manager", body: "ACME · Dhaka. Want us to prepare your application?", link: "/jobs/9", tag: "jobpao-match-9" });
  });

  it("a batch rings once and opens the list", () => {
    const m = pushMessage([{ kind: "match", title: "New 90% match: A", link: "/jobs/1" }, { kind: "match", title: "New 80% match: B", link: "/jobs/2" }, { kind: "reminder", title: "C", link: "/jobs/3" }]);
    expect(m).toEqual({ title: "3 new updates from JobPao", body: "New 90% match: A and 2 more updates", link: "/notifications", tag: "jobpao-updates" });
    expect(pushMessage([])).toBeNull();
    expect(pushMessage([{ kind: "match", title: "New match B", link: "/jobs/other" }])?.tag).toBe("jobpao-match-other");
  });

  it("only opens links inside the app", () => {
    expect(safeLink("/jobs/1")).toBe("/jobs/1");
    expect(safeLink("https://evil.example")).toBe("/notifications");
    expect(safeLink("//evil.example")).toBe("/notifications");
    expect(safeLink(null)).toBe("/notifications");
  });

  it("accepts only real browser subscriptions", () => {
    const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
    expect(validSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys })).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/x", ...keys });
    expect(validSubscription({ endpoint: "http://fcm.googleapis.com/x", keys })).toBeNull();
    expect(validSubscription({ endpoint: "https://x.test", keys: { p256dh: "short", auth: keys.auth } })).toBeNull();
    expect(validSubscription(null)).toBeNull();
  });

  it("iPhone needs the installed app; blocked and off are told apart", () => {
    const base = { push: true, ios: false, standalone: false, permission: "default" as NotificationPermission, subscribed: false };
    expect(pushState({ ...base, ios: true, push: false })).toBe("needs-install");
    expect(pushState({ ...base, ios: true, standalone: true })).toBe("off");
    expect(pushState({ ...base, push: false, permission: null })).toBe("unsupported");
    expect(pushState({ ...base, permission: "denied" })).toBe("blocked");
    expect(pushState({ ...base, permission: "granted", subscribed: true })).toBe("on");
    expect(pushState({ ...base, permission: "granted" })).toBe("off");
  });
});
