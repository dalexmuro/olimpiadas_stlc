/**
 * IONOS DNS CNAME & OAuth Callback Registry
 * Step 7.3: Declarative DNS records and OAuth callback URLs for prod and dev subdomains
 */

export interface DnsCnameRecordSpec {
  environment: "prod" | "dev";
  recordType: "CNAME";
  host: string;
  fqdn: string;
  workerName: string;
  googleCallbackUrl: string;
  microsoftCallbackUrl: string | null;
}

export const IONOS_CNAME_RECORDS: readonly DnsCnameRecordSpec[] = [
  {
    environment: "prod",
    recordType: "CNAME",
    host: "olimpiadas",
    fqdn: "olimpiadas.sitelocuento.com",
    workerName: "olimpiadas-stlc",
    googleCallbackUrl:
      "https://olimpiadas.sitelocuento.com/api/auth/callback/google",
    microsoftCallbackUrl:
      "https://olimpiadas.sitelocuento.com/api/auth/callback/microsoft",
  },
  {
    environment: "dev",
    recordType: "CNAME",
    host: "dev-olimpiadas",
    fqdn: "dev-olimpiadas.sitelocuento.com",
    workerName: "olimpiadas-stlc-dev",
    googleCallbackUrl:
      "https://dev-olimpiadas.sitelocuento.com/api/auth/callback/google",
    microsoftCallbackUrl: null,
  },
] as const;

/**
 * Returns the expected OAuth callback URLs for a given environment.
 */
export function getExpectedOAuthCallbacks(
  environment: "prod" | "dev"
): string[] {
  const rec = IONOS_CNAME_RECORDS.find((r) => r.environment === environment);
  if (!rec) return [];
  return [rec.googleCallbackUrl, rec.microsoftCallbackUrl].filter(
    (url): url is string => Boolean(url)
  );
}
