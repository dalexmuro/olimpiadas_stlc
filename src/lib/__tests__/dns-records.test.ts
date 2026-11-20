import { describe, expect, it } from "vitest";
import {
  IONOS_CNAME_RECORDS,
  getExpectedOAuthCallbacks,
} from "../dns-records";

describe("IONOS DNS CNAME & OAuth Callbacks (Step 7.3)", () => {
  it("defines CNAME records for olimpiadas (prod) and dev-olimpiadas (dev)", () => {
    expect(IONOS_CNAME_RECORDS.length).toBe(2);
    expect(IONOS_CNAME_RECORDS.map((r) => r.host)).toEqual([
      "olimpiadas",
      "dev-olimpiadas",
    ]);
    expect(IONOS_CNAME_RECORDS.every((r) => r.recordType === "CNAME")).toBe(
      true
    );
  });

  it("returns Google + Microsoft callbacks for prod and Google-only callback for dev", () => {
    expect(getExpectedOAuthCallbacks("prod")).toEqual([
      "https://olimpiadas.sitelocuento.com/api/auth/callback/google",
      "https://olimpiadas.sitelocuento.com/api/auth/callback/microsoft",
    ]);
    expect(getExpectedOAuthCallbacks("dev")).toEqual([
      "https://dev-olimpiadas.sitelocuento.com/api/auth/callback/google",
    ]);
  });
});
