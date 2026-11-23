/**
 * Edge-compatible Security Utilities
 * Constant-time secret comparison (Web Crypto SHA-256) and allowlist-based HTML sanitization.
 */

/**
 * Compares two strings in constant time by hashing both with SHA-256 (Web Crypto API)
 * and comparing every byte without short-circuiting.
 * Works identically in Cloudflare Workers Edge and Node.js 20+.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);

  let diff = a.length ^ b.length;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }

  return diff === 0;
}

const DANGEROUS_BLOCK_TAGS =
  /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const DANGEROUS_SELF_CLOSING_TAGS =
  /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)\b[^>]*\/?>/gi;

const EVENT_HANDLER_ATTRS =
  /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const DANGEROUS_URI_ATTRS =
  /\s+(href|src|xlink:href|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:javascript|vbscript):[^\s>]+)/gi;

const SRCDOC_ATTR = /\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Sanitizes HTML intended for public editorial pages and email template previews.
 * Strips executable elements, inline event handlers, and dangerous URI schemes
 * while preserving safe editorial markup (headings, paragraphs, lists, links, emphasis).
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  let cleaned = rawHtml
    .replace(DANGEROUS_BLOCK_TAGS, "")
    .replace(DANGEROUS_SELF_CLOSING_TAGS, "")
    .replace(EVENT_HANDLER_ATTRS, "")
    .replace(DANGEROUS_URI_ATTRS, "")
    .replace(SRCDOC_ATTR, "");

  // Ensure external target="_blank" links include rel="noopener noreferrer"
  cleaned = cleaned.replace(
    /<a\b([^>]*\btarget\s*=\s*["']?_blank["']?[^>]*)>/gi,
    (match, attrs: string) => {
      if (/\brel\s*=/i.test(attrs)) {
        return match;
      }
      return `<a${attrs} rel="noopener noreferrer">`;
    }
  );

  return cleaned.trim();
}
