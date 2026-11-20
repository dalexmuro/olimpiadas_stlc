import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEPLOYMENT_TARGETS,
  REQUIRED_CLOUDFLARE_RUNTIME_SECRETS,
  REQUIRED_GITHUB_ACTION_SECRETS,
  resolveDeploymentTargetForBranch,
} from "../deploy-config";

describe("CI/CD Deployment Configuration (Step 7.1)", () => {
  it("maps dev and main branches to isolated Cloudflare Workers, D1 databases, and domains", () => {
    expect(resolveDeploymentTargetForBranch("dev")).toEqual(
      DEPLOYMENT_TARGETS.dev
    );
    expect(resolveDeploymentTargetForBranch("main")).toEqual(
      DEPLOYMENT_TARGETS.main
    );
    expect(resolveDeploymentTargetForBranch("feature/test")).toBeNull();
    expect(DEPLOYMENT_TARGETS.dev.workerName).not.toBe(
      DEPLOYMENT_TARGETS.main.workerName
    );
    expect(DEPLOYMENT_TARGETS.dev.d1DatabaseName).not.toBe(
      DEPLOYMENT_TARGETS.main.d1DatabaseName
    );
  });

  it("includes GitHub Actions workflow covering verification, D1 migrations, and Wrangler deploy for dev and main", () => {
    const workflowPath = resolve(
      process.cwd(),
      ".github/workflows/deploy.yml"
    );
    const yaml = readFileSync(workflowPath, "utf8");

    expect(yaml).toContain("actions/checkout@v5");
    expect(yaml).toContain("actions/setup-node@v5");
    expect(yaml).toContain("npm run typecheck");
    expect(yaml).toContain("npm run lint");
    expect(yaml).toContain("npm test");
    expect(yaml).toContain("npm run cf:build");
    expect(yaml).toContain("olimpiadas-db-dev");
    expect(yaml).toContain("olimpiadas-db-prod");
    expect(yaml).toContain("wrangler deploy --env dev");
    expect(yaml).toContain("wrangler deploy");
    for (const secretName of REQUIRED_GITHUB_ACTION_SECRETS) {
      expect(yaml).toContain(`secrets.${secretName}`);
    }
    expect(REQUIRED_CLOUDFLARE_RUNTIME_SECRETS.length).toBeGreaterThanOrEqual(7);
  });
});
