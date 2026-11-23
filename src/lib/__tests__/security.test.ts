import { describe, expect, it } from "vitest";
import { constantTimeEqual, sanitizeHtml } from "../security";

describe("Security Utilities (AUD-004 & AUD-005)", () => {
  it("performs constant-time comparison accurately", async () => {
    expect(await constantTimeEqual("Bearer secret-123", "Bearer secret-123")).toBe(
      true
    );
    expect(await constantTimeEqual("Bearer secret-123", "Bearer secret-124")).toBe(
      false
    );
    expect(await constantTimeEqual("short", "longer-secret")).toBe(false);
    expect(await constantTimeEqual("", "")).toBe(true);
  });

  it("strips script tags, event handlers, and javascript: URIs while keeping safe editorial HTML", () => {
    const dirty = [
      '<h2>Bases</h2>',
      '<p onclick="alert(1)">Texto <strong>seguro</strong>.</p>',
      '<script>alert("xss")</script>',
      '<a href="javascript:alert(1)">Malo</a>',
      '<a href="https://sitelocuento.com" target="_blank">Bueno</a>',
      '<iframe src="https://evil.example"></iframe>',
    ].join("");

    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<h2>Bases</h2>");
    expect(clean).toContain("<p>Texto <strong>seguro</strong>.</p>");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain(
      '<a href="https://sitelocuento.com" target="_blank" rel="noopener noreferrer">Bueno</a>'
    );
  });
});
