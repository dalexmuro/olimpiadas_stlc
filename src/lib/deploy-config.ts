/**
 * CI/CD Deployment Topology & Configuration Validator
 * Step 7.1: Maps GitHub branches (dev / main) to Cloudflare Workers, D1 databases, and domains
 */

export interface DeploymentTarget {
  branch: "dev" | "main";
  environment: "dev" | "prod";
  workerName: string;
  d1DatabaseName: string;
  r2BucketName: string;
  publicDomain: string;
  wranglerEnvFlag: string;
}

export const DEPLOYMENT_TARGETS: Readonly<Record<"dev" | "main", DeploymentTarget>> = {
  dev: {
    branch: "dev",
    environment: "dev",
    workerName: "olimpiadas-stlc-dev",
    d1DatabaseName: "olimpiadas-db-dev",
    r2BucketName: "olimpiadas-media-dev",
    publicDomain: "https://dev-olimpiadas.sitelocuento.com",
    wranglerEnvFlag: "--env dev",
  },
  main: {
    branch: "main",
    environment: "prod",
    workerName: "olimpiadas-stlc",
    d1DatabaseName: "olimpiadas-db-prod",
    r2BucketName: "olimpiadas-media-prod",
    publicDomain: "https://olimpiadas.sitelocuento.com",
    wranglerEnvFlag: "",
  },
} as const;

export const REQUIRED_GITHUB_ACTION_SECRETS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
] as const;

export const REQUIRED_CLOUDFLARE_RUNTIME_SECRETS = [
  "BETTER_AUTH_SECRET",
  "BREVO_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "SUPERADMIN_INITIAL_EMAIL",
] as const;

/**
 * Resolves the Cloudflare deployment target for a given Git branch name.
 */
export function resolveDeploymentTargetForBranch(
  branch: string
): DeploymentTarget | null {
  if (branch === "dev") return DEPLOYMENT_TARGETS.dev;
  if (branch === "main") return DEPLOYMENT_TARGETS.main;
  return null;
}
