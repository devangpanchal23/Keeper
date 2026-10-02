/**
 * Post-Deployment Production Smoke Test
 *
 * Verifies that the deployed application is live, healthy, and serving critical routes.
 * Suitable for running in CD pipeline immediately after deployment.
 *
 * Usage:
 *   DEPLOY_URL="https://your-production-app.vercel.app" npx -y tsx scripts/smoke-test.ts
 */

const TARGET_URL = (
  process.env.DEPLOY_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

interface EndpointCheck {
  path: string;
  expectedStatus: number;
  expectedContentType?: string;
  validateBody?: (bodyText: string) => boolean;
}

const CHECKS: EndpointCheck[] = [
  {
    path: "/api/health",
    expectedStatus: 200,
    expectedContentType: "application/json",
    validateBody: (text) => {
      try {
        const json = JSON.parse(text);
        return json.status === "healthy" && json.service === "recall-app";
      } catch {
        return false;
      }
    },
  },
  {
    path: "/",
    expectedStatus: 200,
    expectedContentType: "text/html",
    validateBody: (text) => text.includes("Recall") || text.includes("<html"),
  },
  {
    path: "/sign-in",
    expectedStatus: 200,
    expectedContentType: "text/html",
    validateBody: (text) => text.includes("Welcome back") || text.includes("<html"),
  },
  {
    path: "/sign-up",
    expectedStatus: 200,
    expectedContentType: "text/html",
    validateBody: (text) => text.includes("Create") || text.includes("<html"),
  },
  {
    path: "/api/bulk-import/capabilities?platform=youtube",
    expectedStatus: 200,
    expectedContentType: "application/json",
    validateBody: (text) => {
      try {
        const json = JSON.parse(text);
        return json.success === true && json.platform === "youtube";
      } catch {
        return false;
      }
    },
  },
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheckWithRetry(check: EndpointCheck, maxRetries = 4): Promise<boolean> {
  const url = `${TARGET_URL}${check.path}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Recall-Production-SmokeTest/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      const latency = Date.now() - startTime;
      const text = await response.text();

      const statusMatch = response.status === check.expectedStatus;
      const contentType = response.headers.get("content-type") || "";
      const contentTypeMatch = !check.expectedContentType || contentType.includes(check.expectedContentType);
      const bodyValid = check.validateBody ? check.validateBody(text) : true;

      if (statusMatch && contentTypeMatch && bodyValid) {
        console.log(`  ✓ [HTTP ${response.status}] ${check.path} (${latency}ms)`);
        return true;
      }

      console.warn(`  ⚠ Attempt ${attempt}/${maxRetries} failed for ${check.path}: HTTP ${response.status}, content-type ${contentType || "missing"}`);
    } catch (err) {
      console.warn(`  ⚠ Attempt ${attempt}/${maxRetries} connection error for ${check.path}:`, err instanceof Error ? err.message : err);
    }

    if (attempt < maxRetries) {
      const backoffMs = attempt * 2000;
      await sleep(backoffMs);
    }
  }

  console.error(`  ✗ [FAILED] ${check.path} after ${maxRetries} attempts`);
  return false;
}

async function runSmokeTests() {
  console.log("\n=======================================================");
  console.log("🚀 RUNNING POST-DEPLOYMENT PRODUCTION SMOKE TESTS");
  console.log(`Target URL: ${TARGET_URL}`);
  console.log("=======================================================\n");

  let allPassed = true;

  for (const check of CHECKS) {
    const passed = await runCheckWithRetry(check);
    if (!passed) {
      allPassed = false;
    }
  }

  console.log("\n=======================================================");
  if (allPassed) {
    console.log("✅ ALL PRODUCTION SMOKE CHECKS PASSED. SYSTEM IS HEALTHY.");
    console.log("=======================================================\n");
    process.exit(0);
  } else {
    console.error("❌ SMOKE TEST FAILED: One or more critical endpoints did not respond as expected.");
    console.log("=======================================================\n");
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("Fatal smoke test runner error:", err);
  process.exit(1);
});
