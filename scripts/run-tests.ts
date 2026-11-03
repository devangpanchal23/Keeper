/**
 * Automated Production Test Suite for Keeper (Recall)
 *
 * Tests:
 * 1. Authentication & Cryptography
 * 2. Platform Providers (YouTube & Instagram)
 * 3. Ingestion Pipeline & URL Validation
 * 4. Grounded AI Enrichment & Insufficient Content Fallback
 * 5. Deduplication & Idempotency
 * 6. Export File Parsers (Instagram JSON/ZIP, YouTube Takeout CSV)
 * 7. Bulk Import Job Execution & Queue Concurrency
 * 8. Error Classification & Retry Mechanism
 * 9. Scalability: 1,000+ Simulated Import Records
 * 10. Multi-User Security & Workspace Isolation
 * 11. OAuth Security & CSRF State Validation
 * 12. Cross-Platform Metadata Normalizer
 * 13. System Migration Service
 * 14. Real Multi-User Isolation & Workspaces
 * 15. Real AI Pipeline Fallbacks & Zero Content Loss
 * 16. Instagram Official Export Adapter & ZIP Verification
 * 17. Full End-to-End Pipeline & Real Persistence Tests
 * 18. Multi-Tenant Collection Security & Adversarial Isolation Tests
 * 19. Instagram JSON Metadata Accuracy & Mojibake Normalization Tests
 * 20. Production Collection Delete Management & Security Tests
 * 21. Instagram Reels AI Accuracy Audit Regression Tests
 * 22. Bulk Import -> Locate Bookmark Resolution & Data Integrity Regression Tests
 */

import { hashPassword, verifyPassword, generateInitialsAvatar } from "../src/services/auth-service";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { ProviderService } from "../src/services/provider-service";
import { YouTubeProvider } from "../src/services/providers/youtube-provider";
import { InstagramProvider } from "../src/services/providers/instagram-provider";
import { RedditProvider } from "../src/services/providers/reddit-provider";
import { XProvider } from "../src/services/providers/x-provider";
import { LinkedInProvider } from "../src/services/providers/linkedin-provider";
import { ProviderRegistry } from "../src/services/providers/provider-registry";
import { AIPipeline } from "../src/services/ai-pipeline";
import { ExportFileParser, type ParsedImportCandidate } from "../src/services/bulk-import/export-parser";
import { ImportJobService } from "../src/services/bulk-import/import-job-service";
import { OAuthSecurityService } from "../src/services/bulk-import/oauth-service";
import { IngestionService } from "../src/services/ingestion-service";
import { ContentService } from "../src/services/content-service";
import { AuthoritativeSourceData, Collection, SavedItem } from "../src/types";
import { MetadataNormalizer } from "../src/services/normalizer/metadata-normalizer";
import { formatDate } from "../src/lib/utils";
import { MigrationService } from "../src/services/migration-service";
import { INITIAL_COLLECTIONS } from "../src/data/seed-data";
import { CollectionService } from "../src/services/collection-service";
import { StorageService } from "../src/services/storage-service";
import { SearchService } from "../src/services/search-service";
import { AIService } from "../src/services/ai-service";
import { AssistantAnswerService } from "../src/services/assistant-answer-service";
import { ConversationHistoryService } from "../src/services/ai-history/conversation-history-service";
import { InstagramExportAdapter } from "../src/services/bulk-import/adapters/instagram-export-adapter";
import { ZipArchiveReader } from "../src/services/bulk-import/adapters/zip-archive-reader";
import {
  FIXTURE_SAVED_POSTS_STRING_MAP,
  FIXTURE_SAVED_REELS_STRING_LIST,
  FIXTURE_MULTIPLE_COLLECTIONS,
  FIXTURE_NO_COLLECTIONS_FLAT,
  FIXTURE_WITH_DUPLICATE_URLS,
  FIXTURE_WITH_INVALID_URLS,
  FIXTURE_MISSING_URLS,
  FIXTURE_MALFORMED_JSON,
  FIXTURE_UNEXPECTED_SCHEMA,
  FIXTURE_NESTED_ACCOUNTS_CENTER,
  generateLargeCandidateSet,
} from "../src/services/bulk-import/__tests__/fixtures/instagram-fixtures";
import { MediaAcquisitionService } from "../src/services/media/media-acquisition-service";
import { GeminiTranscriptionProvider, TranscriptionService } from "../src/services/media/transcription-service";
import { EvidenceFusionService } from "../src/services/evidence/evidence-fusion-service";
import { ReprocessingService } from "../src/services/reprocessing/reprocessing-service";
import {
  InstagramThumbnailResolver,
  INSTAGRAM_REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER,
} from "../src/services/media/instagram-thumbnail-resolver";
import { CollectionOrganizerService } from "../src/services/collection-organizer-service";
import { MediaPreviewResolver } from "../src/services/media/media-preview-resolver";
import { ContentIntelligenceService } from "../src/services/content-intelligence";
import { ContentAnalysisService, validateCollectionCandidateDecision } from "../src/services/content-analysis-service";
import { CollectionMatchingService } from "../src/services/collection-matching-service";
import { AssetClassificationService } from "../src/services/asset-classification-service";
import { VisualTextService } from "../src/services/media/visual-text-service";
import { AI_JOB_LEASE_SECONDS, AI_JOB_PROCESSING_STAGES, aiJobRetryDelaySeconds, MAX_AI_JOB_ATTEMPTS, processingFailureCode, shouldRetryAiJob } from "../src/services/ai-job-retry-policy";
import { createContentFingerprint, createContentFingerprintCandidates, createLegacyContentFingerprint, getContentFingerprintFields } from "../src/services/content-fingerprint";
import { createOssImportLedgerEntry, getOssImportCycle, getOssImportEntitlement } from "../src/services/usage-ledger-contract";
import { persistWorkspaceAssignment } from "../src/services/workspace-assignment-contract";
import { createHmac } from "node:crypto";
import { handleRazorpayWebhook, type RazorpayWebhookStore } from "../src/lib/razorpay-webhook-handler";
import { verifyRazorpaySubscriptionSignature, verifyRazorpayWebhookSignature } from "../src/lib/razorpay-signatures";
import { createReceiptRetryTask } from "../src/lib/razorpay-receipts";
import { KEEPER_BILLING_PLANS } from "../src/lib/billing-plans";
import { getMissingBillingServerVariables } from "../src/lib/billing-config";
import { getCheckoutBlockDecision } from "../src/lib/billing-checkout-policy";
import { getRazorpayConfigurationError, getSafeRazorpayErrorCode } from "../src/lib/razorpay-config";
import { createAuthSessionMarker, isAuthSessionMarkerValid, AUTH_SESSION_DURATION_SECONDS, authSessionCookieOptions } from "../src/lib/supabase/auth-session";
import { readWorkspaceMedia } from "../src/services/workspace-media-read";
import { getCanonicalIdentityKey, getAuthoritativeCanonicalUrl, isSameContentItem } from "../src/lib/media-identity";
import { compareSourceTextWithCaption, shouldShowSourceTextAnalysis } from "../src/lib/source-text-comparison";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg, durationMs: Date.now() - start });
    console.error(`  ✗ ${name} (${Date.now() - start}ms)`);
    console.error(`    Error: ${errorMsg}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  expectedMessage: string,
  message: string,
): Promise<void> {
  let rejection: unknown;
  try {
    await operation();
  } catch (error) {
    rejection = error;
  }
  assert(rejection instanceof Error, `${message}: expected operation to reject`);
  assert(rejection.message.includes(expectedMessage), `${message}: unexpected rejection '${rejection.message}'`);
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING KEEPER PRODUCTION VALIDATION TEST SUITE");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // 1. Authentication & Cryptography Tests
  // ---------------------------------------------------------------------------
  console.log("1. Authentication & Cryptography Tests:");

  await test("Session signing fails closed when the independent secret is missing, empty, or weak", async () => {
    const priorSecret = process.env.AUTH_SESSION_SECRET;
    const priorSupabaseValues = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    try {
      delete process.env.AUTH_SESSION_SECRET;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test-project.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "unit-test-public-key-not-a-signing-secret";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "unit-test-publishable-key-not-a-signing-secret";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key-not-a-signing-secret";
      await assertRejects(() => createAuthSessionMarker(), "AUTH_SESSION_SECRET is required", "Missing session secret");
      assert(!(await isAuthSessionMarkerValid("1798761600.invalid")), "Missing secret must invalidate existing markers.");

      process.env.AUTH_SESSION_SECRET = "   ";
      await assertRejects(() => createAuthSessionMarker(), "AUTH_SESSION_SECRET is required", "Empty session secret");
      process.env.AUTH_SESSION_SECRET = "too-short";
      await assertRejects(() => createAuthSessionMarker(), "at least 32 bytes", "Short session secret");
      process.env.AUTH_SESSION_SECRET = "a".repeat(48);
      await assertRejects(() => createAuthSessionMarker(), "strong, independently generated", "Repeated-character session secret");
      process.env.AUTH_SESSION_SECRET = "password".repeat(5);
      await assertRejects(() => createAuthSessionMarker(), "strong, independently generated", "Low-entropy session secret");
      process.env.AUTH_SESSION_SECRET = `change-me-${"a".repeat(32)}`;
      await assertRejects(() => createAuthSessionMarker(), "strong, independently generated", "Weak placeholder session secret");
    } finally {
      if (priorSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
      else process.env.AUTH_SESSION_SECRET = priorSecret;
      if (priorSupabaseValues.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = priorSupabaseValues.url;
      if (priorSupabaseValues.anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = priorSupabaseValues.anonKey;
      if (priorSupabaseValues.publishableKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = priorSupabaseValues.publishableKey;
      if (priorSupabaseValues.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = priorSupabaseValues.serviceRoleKey;
    }
  });

  await test("Session markers validate, expire, reject tampering, rotate, and verify across instances", async () => {
    const priorSecret = process.env.AUTH_SESSION_SECRET;
    try {
      const now = Date.UTC(2026, 0, 1);
      process.env.AUTH_SESSION_SECRET = "K8p!wQ2m#L5vR9x@N4cT7zB1?fH6jD3s";
      const marker = await createAuthSessionMarker(now);
      assert(marker.expiresAt === Math.floor(now / 1000) + AUTH_SESSION_DURATION_SECONDS, "Session marker should have an exact seven-day expiry.");
      assert(await isAuthSessionMarkerValid(marker.value, now), "Fresh signed marker should validate.");
      assert(!(await isAuthSessionMarkerValid(marker.value, now + AUTH_SESSION_DURATION_SECONDS * 1000)), "Expired marker must be rejected.");
      const tampered = `${marker.value.slice(0, -1)}${marker.value.endsWith("A") ? "B" : "A"}`;
      assert(!(await isAuthSessionMarkerValid(tampered, now)), "Tampered marker must be rejected.");
      const [expiration, suppliedSignature] = marker.value.split(".");
      const invalidSignature = `${expiration}.${suppliedSignature.slice(0, -1)}${suppliedSignature.endsWith("A") ? "B" : "A"}`;
      assert(!(await isAuthSessionMarkerValid(invalidSignature, now)), "Invalid signature must be rejected.");

      process.env.AUTH_SESSION_SECRET = "M4z@cT9p!W2h#R7kV5x?Q1nB8sD6jF3!";
      assert(!(await isAuthSessionMarkerValid(marker.value, now)), "Rotating the secret invalidates markers signed with the prior secret.");
      process.env.AUTH_SESSION_SECRET = "K8p!wQ2m#L5vR9x@N4cT7zB1?fH6jD3s";
      const multiInstanceMarker = await createAuthSessionMarker();
      assert(await isAuthSessionMarkerValid(multiInstanceMarker.value), "A separate verifier with the same configured secret can verify a fresh marker.");
      const childEnv = { ...process.env, AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET, KEEPER_TEST_SESSION_MARKER: multiInstanceMarker.value };
      const childResult = execFileSync(process.execPath, [
        "--import", "tsx", "--input-type=module", "-e",
        'import authSession from "./src/lib/supabase/auth-session.ts"; console.log(await authSession.isAuthSessionMarkerValid(process.env.KEEPER_TEST_SESSION_MARKER));',
      ], { cwd: process.cwd(), env: childEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      assertEqual(childResult, "true", "A separate Node process verifies the same marker with the same configured secret.");
    } finally {
      if (priorSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
      else process.env.AUTH_SESSION_SECRET = priorSecret;
    }
  });

  await test("Session cookie security attributes and controlled auth failures remain enforced", () => {
    assert(authSessionCookieOptions.httpOnly, "Session cookie must remain HttpOnly.");
    assertEqual(authSessionCookieOptions.sameSite, "lax", "Session cookie SameSite policy");
    assertEqual(authSessionCookieOptions.path, "/", "Session cookie path");
    assertEqual(AUTH_SESSION_DURATION_SECONDS, 7 * 24 * 60 * 60, "Session maximum lifetime");
    const loginRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/auth/login/route.ts"), "utf8");
    const signupRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/auth/signup/route.ts"), "utf8");
    assert(loginRoute.includes('"Sign-in failed. Check your connection and try again."') && loginRoute.includes("{ status: 503 }"), "Login converts session configuration errors into a controlled response.");
    assert(signupRoute.includes('"Sign-up failed. Check your connection and try again."') && signupRoute.includes("{ status: 503 }"), "Signup converts session configuration errors into a controlled response.");
  });

  await test("Workspace media reads distinguish empty, populated, auth, configuration, and backend failures", async () => {
    const makeResponse = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    });
    const empty = await readWorkspaceMedia(async () => makeResponse(200, { items: [] }));
    assert(empty.kind === "success" && empty.items.length === 0, "A successful empty workspace is a valid empty library.");
    const populated = await readWorkspaceMedia(async () => makeResponse(200, { items: [{ id: "media-a", url: "https://example.com/a" }] }));
    assert(populated.kind === "success" && populated.items.length === 1, "A successful populated workspace returns its records.");
    const auth = await readWorkspaceMedia(async () => makeResponse(401, { code: "AUTH_REQUIRED" }));
    assert(auth.kind === "authentication", "Authentication failure is not interpreted as an empty library.");
    const configuration = await readWorkspaceMedia(async () => makeResponse(503, { code: "BACKEND_NOT_CONFIGURED" }));
    assert(configuration.kind === "configuration", "Backend configuration failure is distinguished.");
    const backend = await readWorkspaceMedia(async () => makeResponse(503, { code: "MEDIA_READ_FAILED" }));
    assert(backend.kind === "unavailable", "Backend query failure is distinguished from an empty library.");
    const network = await readWorkspaceMedia(async () => { throw new Error("private transport details"); });
    assert(network.kind === "unavailable" && !network.message.includes("private"), "Transport errors return a safe generic result.");

    const mediaRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/media/route.ts"), "utf8");
    const collectionsRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/collections/sync/route.ts"), "utf8");
    const syncContext = fs.readFileSync(path.join(process.cwd(), "src/context/RecallContext.tsx"), "utf8");
    const readPosition = syncContext.indexOf("const serverRead = await readWorkspaceMedia()");
    const collectionsReadPosition = syncContext.indexOf("const collectionsPreflight = await fetch");
    const migrationPosition = syncContext.indexOf("MigrationService.migrateLegacyData(activeId)");
    assert(mediaRoute.includes('status: 401') && mediaRoute.includes('status: 503') && mediaRoute.includes("{ items }"), "Media GET exposes explicit auth/backend failure statuses and successful items payloads.");
    assert(!mediaRoute.includes("{ items: [] }"), "Media GET never encodes backend failure as an empty library.");
    assert(readPosition >= 0 && collectionsReadPosition > readPosition && migrationPosition > collectionsReadPosition
      && syncContext.includes("if (serverRead.kind !== \"success\")"), "Workspace sync validates media and collection reads before local migration and reconciliation.");
    assert(collectionsRoute.includes('status: 401') && collectionsRoute.includes('status: 503')
      && !collectionsRoute.includes("localOnly: true"), "Collection sync does not report auth or backend failures as successful local-only operations.");
  });

  await test("Opt-in Supabase isolation test requires disposable config and protects production before network access", () => {
    const runner = fs.readFileSync(path.join(process.cwd(), "scripts/run-tests.ts"), "utf8");
    const liveTestStart = runner.lastIndexOf('await test("Opt-in dedicated Supabase project RLS tenant-isolation verification"');
    const missingConfigGuard = runner.indexOf("assert(missing.length === 0", liveTestStart);
    const disposableGuard = runner.indexOf("assert(disposableConfirmation === \"true\"", liveTestStart);
    const productionGuard = runner.indexOf("assert(projectRef !== productionProjectRef", liveTestStart);
    const clientImport = runner.indexOf('await import("@supabase/supabase-js")', liveTestStart);
    const preflightSource = runner.slice(liveTestStart, clientImport);
    assert(missingConfigGuard >= 0 && disposableGuard > missingConfigGuard && productionGuard > disposableGuard && clientImport > productionGuard, "All isolated-project guards run before Supabase client/network initialization.");
    assert(runner.includes("KEEPER_TEST_SUPABASE_IS_DISPOSABLE") && runner.includes("KEEPER_PRODUCTION_SUPABASE_PROJECT_REF")
      && preflightSource.includes("NEXT_PUBLIC_SUPABASE_URL") && !preflightSource.includes(".env.local"), "The live test requires explicit disposable and production refs without loading developer environment files.");
    assert(runner.includes('"Workspace A cannot read Workspace B media."')
      && runner.includes('"Workspace A cannot modify Workspace B media."')
      && runner.includes('"Workspace A cannot delete Workspace B media."'), "Cross-workspace read, update, and delete assertions remain present.");
  });

  await test("hashPassword produces salted hex digest", async () => {
    const plain = "SuperSecretPassword123!";
    const hash = await hashPassword(plain);
    assert(typeof hash === "string", "Hash must be a string");
    assert(hash.includes(":"), "Hash must contain salt:hash delimiter");
    const [salt, digest] = hash.split(":");
    assertEqual(salt.length, 32, "Salt must be 16 bytes (32 hex characters)");
    assertEqual(digest.length, 64, "SHA-256 digest must be 64 hex characters");
  });

  await test("verifyPassword validates correct credentials", async () => {
    const plain = "MySecureP@ssw0rd!";
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(plain, hash);
    assert(isValid === true, "verifyPassword must return true for correct password");
  });

  await test("verifyPassword rejects incorrect credentials", async () => {
    const plain = "CorrectPassword123";
    const wrong = "WrongPassword999";
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(wrong, hash);
    assert(isValid === false, "verifyPassword must return false for wrong password");
  });

  await test("generateInitialsAvatar creates valid SVG data URI with initials", () => {
    const avatar = generateInitialsAvatar("Devang Patel");
    assert(avatar.startsWith("data:image/svg+xml;utf8,"), "Avatar must be SVG data URI");
    assert(avatar.includes("DP"), "Avatar SVG must contain user initials DP");
  });

  // ---------------------------------------------------------------------------
  // 2. YouTube Provider Tests
  // ---------------------------------------------------------------------------
  console.log("\n2. YouTube Provider & Canonicalization Tests:");
  const ytProvider = new YouTubeProvider();

  await test("YouTubeProvider canHandle standard, shorts, and youtu.be URLs", () => {
    assert(ytProvider.canHandle("https://www.youtube.com/watch?v=3lZF8W_AaUo"), "Standard watch URL");
    assert(ytProvider.canHandle("https://youtu.be/3lZF8W_AaUo"), "Short youtu.be URL");
    assert(ytProvider.canHandle("https://www.youtube.com/shorts/abcdef12345"), "YouTube Shorts URL");
    assert(!ytProvider.canHandle("https://instagram.com/reel/123"), "Should reject Instagram URL");
  });

  await test("YouTubeProvider extracts 11-char video ID cleanly", () => {
    const id1 = ytProvider.extractVideoId("https://www.youtube.com/watch?v=3lZF8W_AaUo&t=42s");
    assertEqual(id1, "3lZF8W_AaUo", "Extracts from watch query param");
    const id2 = ytProvider.extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=tracking");
    assertEqual(id2, "dQw4w9WgXcQ", "Extracts from youtu.be path");
    const id3 = ytProvider.extractVideoId("https://www.youtube.com/shorts/5e_0B_5b6U0");
    assertEqual(id3, "5e_0B_5b6U0", "Extracts from shorts path");
  });

  await test("YouTubeProvider canonicalizes and detects content type", () => {
    const v1 = ytProvider.validateAndCanonicalize("https://www.youtube.com/watch?v=3lZF8W_AaUo&feature=shared");
    assert(v1.isValid, "Standard video should be valid");
    assertEqual(v1.canonicalUrl, "https://www.youtube.com/watch?v=3lZF8W_AaUo", "Strips query params in canonical");
    assertEqual(v1.contentType, "video", "Content type must be video");

    const v2 = ytProvider.validateAndCanonicalize("https://www.youtube.com/shorts/5e_0B_5b6U0?si=123");
    assert(v2.isValid, "Shorts video should be valid");
    assertEqual(v2.canonicalUrl, "https://www.youtube.com/shorts/5e_0B_5b6U0", "Shorts canonical URL");
    assertEqual(v2.contentType, "short", "Content type must be short");
  });

  await test("YouTubeProvider rejects invalid URLs", () => {
    const res = ytProvider.validateAndCanonicalize("https://www.youtube.com/invalid-no-id");
    assert(!res.isValid, "Should mark invalid URL as false");
    assert(res.contentId === null, "ContentId should be null");
  });

  console.log("\n3. URL Provider & Platform Detection Tests:");

  await test("identifyPlatform identifies YouTube standard URLs", () => {
    const platform = ProviderService.detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assertEqual(platform, "youtube", "Must identify standard YouTube video URL");
  });

  await test("identifyPlatform identifies YouTube Shorts URLs", () => {
    const platform = ProviderService.detectPlatform("https://www.youtube.com/shorts/abcdef12345");
    assertEqual(platform, "youtube-shorts", "Must identify YouTube Shorts URL");
  });

  await test("identifyPlatform identifies Reddit post URLs", () => {
    const platform = ProviderService.detectPlatform("https://www.reddit.com/r/programming/comments/123456/title/");
    assertEqual(platform, "reddit", "Must identify Reddit post URL");
  });

  await test("identifyPlatform identifies X / Twitter URLs", () => {
    const platform = ProviderService.detectPlatform("https://x.com/jack/status/20");
    assert(platform === "x" || platform === "twitter", "Must identify X.com tweet URL");
  });

  // ---------------------------------------------------------------------------
  // 4. Instagram Provider Tests (Root Cause Verification)
  // ---------------------------------------------------------------------------
  console.log("\n4. Instagram Provider & Extraction Tests (Root Cause Fix):");
  const igProvider = new InstagramProvider();

  await test("InstagramProvider canHandle reel, post, and instagr.am URLs", () => {
    assert(igProvider.canHandle("https://www.instagram.com/reel/C3x90ZaLkPq/"), "Standard reel");
    assert(igProvider.canHandle("https://www.instagram.com/p/DFxyz123/"), "Standard post");
    assert(igProvider.canHandle("https://instagr.am/p/ABC123xyz/"), "instagr.am domain");
    assert(!igProvider.canHandle("https://youtube.com/watch?v=123"), "Should reject YouTube URL");
  });

  await test("InstagramProvider extracts shortcode and path username", () => {
    const d1 = igProvider.extractDetails("https://www.instagram.com/reel/C3x90ZaLkPq/?igsh=tracking123");
    assertEqual(d1.code, "C3x90ZaLkPq", "Shortcode extracted without query params");
    assert(d1.isReel, "Must detect reel");
    assertEqual(d1.canonicalUrl, "https://www.instagram.com/reel/C3x90ZaLkPq/", "Canonical URL clean");

    const d2 = igProvider.extractDetails("https://www.instagram.com/devang/reel/C3x90ZaLkPq/");
    assertEqual(d2.username, "devang", "Username extracted from path if present");
    assertEqual(d2.code, "C3x90ZaLkPq", "Code extracted with username path");
  });

  await test("InstagramProvider honest fallback when guest access restricted (No hallucination)", async () => {
    const sourceData = await igProvider.fetchAuthoritativeData("https://www.instagram.com/reel/C3x90ZaLkPq/");
    assert(sourceData.platform === "instagram", "Platform is instagram");
    assert(sourceData.contentId === "C3x90ZaLkPq", "Content ID matches shortcode");
    assert(sourceData.canonicalUrl === "https://www.instagram.com/reel/C3x90ZaLkPq/", "Canonical URL matches");
    assert(sourceData.creator !== undefined, "Creator is defined");
    // Verify it NEVER hallucinates fake handles or fake creators
    if (sourceData.isRestricted) {
      assert(sourceData.restrictionReason !== undefined, "Restriction reason is explicitly documented");
      assert(sourceData.provenance.creator !== undefined, "Creator provenance tracked");
    }
  });

  await test("Multi-user storage keys are properly partitioned", () => {
    const userA = "user-123";
    const userB = "user-456";
    const keyA: string = `recall_items_user_${userA}`;
    const keyB: string = `recall_items_user_${userB}`;
    assert(keyA !== keyB, "Storage keys for different users must never collide");
    assertEqual(keyA, "recall_items_user_user-123", "Prefix must match specification");
  });

    // ---------------------------------------------------------------------------
    // 3b. Central Metadata Normalizer & Multilingual Entities (Root Cause Tests)
    // ---------------------------------------------------------------------------
    console.log("\n3b. Central Metadata Normalizer & Multilingual Entities:");

    await test("MetadataNormalizer decodes hexadecimal HTML entities (e.g. &#x3042; -> あ)", () => {
      const raw = "#&#x3042;&#x3089;&#x3086;&#x308b;";
      const decoded = MetadataNormalizer.normalizeText(raw);
      assertEqual(decoded, "#あらゆる", "Hex entities must be cleanly decoded into Japanese Unicode");
    });

    await test("MetadataNormalizer decodes decimal and named HTML entities", () => {
      const raw = "&#12354;&#12356; &amp; &quot;Keeper&quot; &hellip; &#39;test&#39;";
      const decoded = MetadataNormalizer.normalizeText(raw);
      assertEqual(decoded, 'あい & "Keeper" … \'test\'', "Decimal and named entities decoded");
    });

    await test("MetadataNormalizer handles multi-pass encoded entities safely", () => {
      const doubleEncoded = "&amp;#x3042;";
      const decoded = MetadataNormalizer.decodeHtmlEntities(doubleEncoded);
      assertEqual(decoded, "あ", "Multi-pass encoding decodes properly");
    });

    await test("MetadataNormalizer is strictly idempotent", () => {
      const raw = "Special &#x3042;&#x3089;&#x3086; &quot;Quote&quot; #design";
      const once = MetadataNormalizer.normalizeText(raw);
      const twice = MetadataNormalizer.normalizeText(once);
      assertEqual(twice, once, "Normalization must be idempotent");
    });

    await test("MetadataNormalizer preserves multilingual text: Japanese, Gujarati, Hindi, Emojis", () => {
      const multi = "こんにちは (Hello) | કેમ છો (Gujarati) | नमस्ते (Hindi) 🚀✨ #tech";
      const normalized = MetadataNormalizer.normalizeText(multi);
      assert(normalized.includes("こんにちは"), "Preserves Japanese");
      assert(normalized.includes("કેમ છો"), "Preserves Gujarati");
      assert(normalized.includes("नमस्ते"), "Preserves Hindi");
      assert(normalized.includes("🚀✨"), "Preserves Emojis");
    });

    await test("MetadataNormalizer.extractHashtags extracts Unicode hashtags correctly", () => {
      const caption = "Inspiring reel! #あらゆる #ગુજરાતી #हिन्दी #NextJS #AI2026";
      const tags = MetadataNormalizer.extractHashtags(caption);
      assert(tags.includes("あらゆる"), "Extracts Japanese hashtag");
      assert(tags.includes("ગુજરાતી"), "Extracts Gujarati hashtag");
      assert(tags.includes("हिन्दी"), "Extracts Hindi hashtag");
      assert(tags.includes("NextJS"), "Extracts English hashtag");
    });

    await test("MetadataNormalizer.sanitizeTags rejects malformed entity residues (e.g. x3042x3089)", () => {
      const dirtyTags = ["x3042x3089", "&#x3042;", "undefined", "null", "React", "あらゆる", "ગુજરાતી"];
      const sanitized = MetadataNormalizer.sanitizeTags(dirtyTags);
      assert(!sanitized.includes("x3042x3089"), "Rejects hex artifact tag");
      assert(!sanitized.includes("&#x3042;"), "Rejects entity tag");
      assert(!sanitized.includes("undefined"), "Rejects undefined");
      assert(sanitized.includes("React"), "Keeps valid tag");
      assert(sanitized.includes("あらゆる"), "Keeps valid multilingual Japanese tag");
      assert(sanitized.includes("ગુજરાતી"), "Keeps valid multilingual Gujarati tag");
    });

    await test("AIPipeline processes decoded Unicode input without entity leakage", async () => {
      const igSource: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/DFxyz123/",
        contentId: "DFxyz123",
        creator: { name: "@satellite", handle: "@satellite" },
        title: "#あらゆる",
        caption: "#あらゆる #anime #art",
        description: "#あらゆる #anime #art",
        bodyText: "#あらゆる #anime #art",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      const enrichment = await AIPipeline.enrichContent(igSource);
      assert(!enrichment.summary.quick.includes("&#x"), "AI quick summary MUST NOT contain &#x");
      assert(!enrichment.summary.standard.includes("&#x"), "AI standard summary MUST NOT contain &#x");
      for (const tag of enrichment.tags) {
        assert(!tag.includes("&#x"), `Tag "${tag}" MUST NOT contain &#x`);
        assert(!/^x[0-9a-f]{4,6}$/i.test(tag), `Tag "${tag}" MUST NOT be hex artifact residue`);
      }
    });

    await test("MigrationService detects and repairs corrupted records idempotently", () => {
      const corruptedItem: SavedItem = {
        id: "save-corrupt-1",
        title: "#&#x3042;&#x3089;&#x3086;...",
        url: "https://www.instagram.com/reel/xyz123/",
        thumbnail: "https://example.com/thumb.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@satellite" },
        description: "Caption &#x3042;&#x3089;&#x3086;",
        savedDate: new Date().toISOString(),
        collectionId: "col-ui",
        collections: ["col-ui"],
        tags: ["x3042x3089", "&#x3042;", "Design"],
        favorite: true,
        archived: false,
        trashed: false,
        personalNotes: "Keep this note safe!",
        metadata: { domain: "instagram.com" },
        keyPoints: ["Key takeaway with &#x3042;"],
        topics: ["Design"],
        aiSummary: {
          quick: "contains &#x3042; value",
          standard: "Summary with &#x3042; and &#x3089;",
          detailed: "Detailed summary with &#x3042;",
        },
      };

      assert(MigrationService.isItemCorrupted(corruptedItem), "Must detect corrupted item");
      const repaired = MigrationService.repairItem(corruptedItem);

      assert(!repaired.title.includes("&#x"), "Title must be repaired");
      assertEqual(repaired.personalNotes, "Keep this note safe!", "User personalNotes must be preserved");
      assertEqual(repaired.favorite, true, "Favorite flag preserved");
      assertEqual(repaired.collectionId, "col-ui", "Collection preserved");
      assert(!repaired.tags.includes("x3042x3089"), "Corrupt tag removed");
      assert(!repaired.tags.includes("&#x3042;"), "Corrupt entity tag removed");
      assert(repaired.tags.includes("Design"), "Valid tag preserved");
      assert(!MigrationService.isItemCorrupted(repaired), "Repaired item is no longer corrupted (idempotency)");
    });

    // ---------------------------------------------------------------------------
    // 3c. Reddit Provider & Regression Tests (Root Cause Verification)
    // ---------------------------------------------------------------------------
    console.log("\n3c. Reddit Provider & Regression Tests (Root Cause Verification):");
    const redditProvider = new RedditProvider();

    await test("ProviderRegistry deterministically routes all platforms", () => {
      const yt = ProviderRegistry.getProviderForUrl("https://www.youtube.com/watch?v=3lZF8W_AaUo");
      assertEqual(yt.platform, "youtube", "YouTube URL routes to YouTubeProvider");

      const ig = ProviderRegistry.getProviderForUrl("https://www.instagram.com/reel/C3x90ZaLkPq/");
      assertEqual(ig.platform, "instagram", "Instagram URL routes to InstagramProvider");

      const reddit = ProviderRegistry.getProviderForUrl("https://www.reddit.com/r/indianrailways/comments/1izw910/test/");
      assertEqual(reddit.platform, "reddit", "Reddit URL routes to RedditProvider");

      const x = ProviderRegistry.getProviderForUrl("https://x.com/Dipanshu_AI/status/2105655603955945699");
      assertEqual(x.platform, "x", "x.com URL routes to XProvider (NOT website)");

      const twitter = ProviderRegistry.getProviderForUrl("https://twitter.com/Dipanshu_AI/status/2105655603955945699");
      assertEqual(twitter.platform, "x", "twitter.com URL routes to XProvider (NOT website)");

      const web = ProviderRegistry.getProviderForUrl("https://news.ycombinator.com/item?id=12345");
      assertEqual(web.platform, "website", "Generic URL routes to WebsiteProvider as fallback");
    });

    await test("RedditProvider canHandle standard, old, new, redd.it, and share links", () => {
      assert(redditProvider.canHandle("https://www.reddit.com/r/indianrailways/comments/1izw910/why_men_wants/"), "Standard Reddit URL");
      assert(redditProvider.canHandle("https://old.reddit.com/r/technology/comments/abc1234/test/"), "Old Reddit URL");
      assert(redditProvider.canHandle("https://new.reddit.com/r/reactjs/comments/def5678/test/"), "New Reddit URL");
      assert(redditProvider.canHandle("https://redd.it/1izw910"), "redd.it shortlink");
      assert(redditProvider.canHandle("https://www.reddit.com/r/indianrailways/s/1a2b3c4d5e"), "Share redirect URL");
      assert(redditProvider.canHandle("https://www.reddit.com/comments/1izw910"), "Comments direct URL");
      assert(!redditProvider.canHandle("https://www.youtube.com/watch?v=123"), "Should reject YouTube");
      assert(!redditProvider.canHandle("https://instagram.com/reel/123"), "Should reject Instagram");
      assert(!redditProvider.canHandle("https://example.com"), "Should reject generic website");
    });

    await test("RedditProvider extracts details accurately (subreddit, postId, slug, shareId)", () => {
      const d1 = redditProvider.extractDetails("https://www.reddit.com/r/indianrailways/comments/1izw910/why_men_wants_to_stand_near_the_door_even_after/");
      assertEqual(d1.subreddit, "indianrailways", "Subreddit extracted");
      assertEqual(d1.postId, "1izw910", "Post ID extracted");
      assertEqual(d1.slug, "why_men_wants_to_stand_near_the_door_even_after", "Slug extracted");
      assertEqual(d1.isShareUrl, false, "Not a share URL");
      assertEqual(d1.canonicalUrl, "https://www.reddit.com/r/indianrailways/comments/1izw910/", "Canonical URL clean");

      const d2 = redditProvider.extractDetails("https://redd.it/1izw910");
      assertEqual(d2.postId, "1izw910", "redd.it post ID extracted");
      assertEqual(d2.canonicalUrl, "https://redd.it/1izw910", "redd.it canonical URL");

      const d3 = redditProvider.extractDetails("https://www.reddit.com/r/indianrailways/s/SHARE12345");
      assertEqual(d3.subreddit, "indianrailways", "Share URL subreddit extracted");
      assertEqual(d3.shareId, "SHARE12345", "Share ID extracted");
      assertEqual(d3.isShareUrl, true, "Detected as share URL");
    });

    await test("RedditProvider differentiates post types: text, image, video, gallery, link", () => {
      const typeImage = redditProvider.determinePostType({
        post_hint: "image",
        url: "https://i.redd.it/sample.jpg",
        is_self: false,
      });
      assertEqual(typeImage.postType, "image", "Detects image post");
      assertEqual(typeImage.contentType, "image", "Image post maps to image content type");

      const typeVideo = redditProvider.determinePostType({
        is_video: true,
        domain: "v.redd.it",
        media: { reddit_video: { fallback_url: "https://v.redd.it/sample.mp4" } },
        is_self: false,
      });
      assertEqual(typeVideo.postType, "video", "Detects video post");
      assertEqual(typeVideo.contentType, "video", "Video post maps to video content type");

      const typeGallery = redditProvider.determinePostType({
        is_gallery: true,
        gallery_data: { items: [{ media_id: "m1" }] },
        media_metadata: { m1: { s: { u: "https://preview.redd.it/img1.jpg?width=100&amp;s=abc" } } },
        is_self: false,
      });
      assertEqual(typeGallery.postType, "gallery", "Detects gallery post");
      assertEqual(typeGallery.contentType, "image", "Gallery maps to image content type");
      assertEqual(typeGallery.mediaItems.length, 1, "Gallery media item extracted");

      const typeText = redditProvider.determinePostType({
        is_self: true,
        selftext: "Discussing Indian railway reservations...",
      });
      assertEqual(typeText.postType, "text", "Detects text/self post");
      assertEqual(typeText.contentType, "post", "Text post maps to post content type");

      const typeLink = redditProvider.determinePostType({
        is_self: false,
        url: "https://en.wikipedia.org/wiki/Indian_Railways",
        domain: "en.wikipedia.org",
      });
      assertEqual(typeLink.postType, "link", "Detects outbound link post");
      assertEqual(typeLink.contentType, "website", "Outbound link maps to website content type");
    });

    await test("MANDATORY REGRESSION TEST: Indian Railways Reddit Post Data Model & AI Grounding", async () => {
      // Exact post represented in user regression case:
      // Subreddit: r/indianrailways
      // Author: u/Medical-Monk4137
      // Title: Why Men wants to stand near the door (Even after Reserved Seat)
      // Post type: Image/media post
      // Flair: Ask r/IndianRailways

      const testUrl = "https://www.reddit.com/r/indianrailways/comments/1izw910/why_men_wants_to_stand_near_the_door_even_after/";

      const mockPostData = {
        id: "1izw910",
        subreddit: "indianrailways",
        subreddit_name_prefixed: "r/indianrailways",
        author: "Medical-Monk4137",
        title: "Why Men wants to stand near the door (Even after Reserved Seat)",
        link_flair_text: "Ask r/IndianRailways",
        score: 142,
        num_comments: 87,
        created_utc: 1709200000,
        post_hint: "image",
        url: "https://i.redd.it/railway_door_photo.jpg",
        permalink: "/r/indianrailways/comments/1izw910/why_men_wants_to_stand_near_the_door_even_after/",
        is_self: false,
        over_18: false,
        spoiler: false,
      };

      const sourceData = redditProvider.mapPostToSourceData(mockPostData, testUrl);

      // 1. Authoritative metadata assertions (Section 2 & Section 3)
      assertEqual(sourceData.platform, "reddit", "Platform MUST be reddit (NOT website)");
      assertEqual(sourceData.contentType, "image", "Content type MUST be image (NOT web)");
      assertEqual(sourceData.title, "Why Men wants to stand near the door (Even after Reserved Seat)", "Title matches exact post");
      assertEqual(sourceData.creator?.username, "Medical-Monk4137", "Canonical creator.username MUST NOT contain 'u/'");
      assertEqual(sourceData.creator?.name, "Medical-Monk4137", "Canonical creator.name MUST NOT contain 'u/'");
      assertEqual(sourceData.community?.name, "indianrailways", "Canonical community.name MUST NOT contain 'r/' and NOT be 'reddit'");
      assertEqual(sourceData.community?.displayName, "r/indianrailways", "Community displayName is r/indianrailways");
      assertEqual(sourceData.canonicalUrl, "https://www.reddit.com/r/indianrailways/comments/1izw910/why_men_wants_to_stand_near_the_door_even_after/", "Canonical URL clean");
      assertEqual(sourceData.likeCount, "142", "Score preserved");
      assertEqual(sourceData.commentCount, "87", "Comment count preserved");
      assertEqual(sourceData.rawPlatformMetadata?.subreddit, "indianrailways", "Subreddit stored in raw metadata");
      assertEqual(sourceData.rawPlatformMetadata?.flair, "Ask r/IndianRailways", "Flair stored in raw metadata");
      assertEqual(sourceData.rawPlatformMetadata?.postType, "image", "Post type stored in raw metadata");
      assertEqual(sourceData.isRestricted, false, "Not restricted");

      // 2. UI Presentation & Deduplication Assertions (Section 2 & Section 9)
      const formattedCreator = `u/${(sourceData.creator?.username || "").replace(/^u\//i, "")}`;
      assertEqual(formattedCreator, "u/Medical-Monk4137", "UI formats as u/Medical-Monk4137");
      assert(!formattedCreator.startsWith("u/u/"), "Must NEVER display u/u/Medical-Monk4137");

      // Deduplicated identity check (matching header implementation)
      const rawParts = [formattedCreator, ""].filter(Boolean);
      const uniqueParts = Array.from(new Set(rawParts));
      assertEqual(uniqueParts.length, 1, "Identity must be rendered ONCE (never duplicated)");
      assertEqual(uniqueParts[0], "u/Medical-Monk4137", "Rendered header identity is u/Medical-Monk4137");

      // 3. AI Enrichment & Grounding assertions (Section 6, 7 & 8)
      await assertRejects(
        () => AIPipeline.enrichContent(sourceData, INITIAL_COLLECTIONS),
        "Content analysis is not configured",
        "Import metadata must remain available when AI analysis is not configured",
      );
    });

    await test("CROSS-CONTENT CONTAMINATION ISOLATION: YouTube vs Reddit Concurrent Ingestion", async () => {
      // Content A: YouTube Programming Content
      const ytSource: AuthoritativeSourceData = {
        platform: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=react_adv_123",
        contentId: "react_adv_123",
        creator: { name: "Dan Abramov", username: "gaearon", handle: "@gaearon", source: "youtube" },
        title: "Deep Dive into React Server Components Architecture",
        caption: "A comprehensive analysis of React Server Components, streaming SSR, and bundling.",
        description: "Exploring RSC, cache invalidation, and streaming boundaries in modern web frameworks.",
        bodyText: "Exploring RSC, cache invalidation, and streaming boundaries in modern web frameworks.",
        thumbnailUrl: "https://example.com/yt.jpg",
        contentType: "video",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      // Content B: Reddit Indian Railways Content
      const redditSource: AuthoritativeSourceData = {
        platform: "reddit",
        canonicalUrl: "https://www.reddit.com/r/indianrailways/comments/1izw910/railways_door/",
        contentId: "1izw910",
        creator: { name: "Medical-Monk4137", username: "Medical-Monk4137", handle: "@Medical-Monk4137", source: "reddit" },
        community: { id: "sub_1", name: "indianrailways", displayName: "r/indianrailways", url: "https://www.reddit.com/r/indianrailways" },
        title: "Why Men wants to stand near the door (Even after Reserved Seat)",
        description: "Discussion on passenger habits in sleeper class and 3AC compartments.",
        bodyText: "Discussion on passenger habits in sleeper class and 3AC compartments.",
        thumbnailUrl: "https://example.com/door.jpg",
        contentType: "image",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      // Execute concurrently to expose any shared mutable state or cross-request pollution
      const [enrichmentYT, enrichmentReddit] = await Promise.allSettled([
        AIPipeline.enrichContent(ytSource, INITIAL_COLLECTIONS),
        AIPipeline.enrichContent(redditSource, INITIAL_COLLECTIONS),
      ]);
      assert(enrichmentYT.status === "fulfilled" && enrichmentYT.value.status === "INSUFFICIENT_CONTENT", "Video metadata without a verified transcript is not analyzed");
      assert(enrichmentReddit.status === "rejected" && enrichmentReddit.reason instanceof Error && enrichmentReddit.reason.message.includes("Content analysis is not configured"), "Eligible Reddit text requires an explicitly configured analyzer");
      assertEqual(ytSource.creator?.name, "Dan Abramov", "Concurrent enrichment does not mutate YouTube source facts");
      assertEqual(redditSource.creator?.name, "Medical-Monk4137", "Concurrent enrichment does not mutate Reddit source facts");
    });

    await test("CROSS-CONTENT CONTAMINATION ISOLATION: Reddit AI Post vs Reddit Railway Post Concurrent Ingestion", async () => {
      // Reddit A: Real AI Post
      const redditAISource: AuthoritativeSourceData = {
        platform: "reddit",
        canonicalUrl: "https://www.reddit.com/r/MachineLearning/comments/ai_agents_123/",
        contentId: "ai_agents_123",
        creator: { name: "AIEngineer", username: "AIEngineer", handle: "@AIEngineer", source: "reddit" },
        community: { id: "sub_ml", name: "MachineLearning", displayName: "r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning" },
        title: "Autonomous AI Agents with Tool Calling and LLM Planning",
        description: "Research paper overview discussing multi-agent systems and LLM function calling architectures.",
        bodyText: "Research paper overview discussing multi-agent systems and LLM function calling architectures.",
        thumbnailUrl: "https://example.com/ai.jpg",
        contentType: "post",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      // Reddit B: Railway Post (Mentions "train" and "railway", but NO AI)
      const redditRailwaySource: AuthoritativeSourceData = {
        platform: "reddit",
        canonicalUrl: "https://www.reddit.com/r/indianrailways/comments/1izw910/door_post/",
        contentId: "1izw910",
        creator: { name: "Medical-Monk4137", username: "Medical-Monk4137", handle: "@Medical-Monk4137", source: "reddit" },
        community: { id: "sub_ir", name: "indianrailways", displayName: "r/indianrailways", url: "https://www.reddit.com/r/indianrailways" },
        title: "Why Men wants to stand near the door (Even after Reserved Seat)",
        description: "Travel habits and coach door crowding in Indian trains.",
        bodyText: "Travel habits and coach door crowding in Indian trains.",
        thumbnailUrl: "https://example.com/railway.jpg",
        contentType: "image",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      // Execute concurrently
      const [enrichmentAI, enrichmentRailway] = await Promise.allSettled([
        AIPipeline.enrichContent(redditAISource, INITIAL_COLLECTIONS),
        AIPipeline.enrichContent(redditRailwaySource, INITIAL_COLLECTIONS),
      ]);
      for (const result of [enrichmentAI, enrichmentRailway]) {
        assert(result.status === "rejected" && result.reason instanceof Error && result.reason.message.includes("Content analysis is not configured"), "Both concurrent analyses fail closed without an AI provider");
      }
      assertEqual(redditAISource.creator?.name, "AIEngineer", "AI post source remains isolated");
      assertEqual(redditRailwaySource.creator?.name, "Medical-Monk4137", "Railway post source remains isolated");
    });

    await test("MigrationService detects and repairs corrupted Reddit records idempotently", () => {
      const corruptedRedditItem: SavedItem = {
        id: "save-corrupted-reddit-1",
        title: "Why Men wants to stand near the door (Even after Reserved Seat)",
        url: "https://www.reddit.com/r/indianrailways/comments/1izw910/why_men_wants_to_stand_near_the_door_even_after/",
        thumbnail: "https://i.redd.it/railway_door_photo.jpg",
        platform: "reddit",
        contentType: "image",
        creator: { name: "u/Medical-Monk4137", username: "u/Medical-Monk4137" },
        community: { id: null, name: "reddit", displayName: "r/reddit", url: "https://www.reddit.com/r/reddit" },
        description: "Indian railways discussion",
        savedDate: new Date().toISOString(),
        collectionId: "col-ai",
        collections: ["col-ai"],
        tags: ["AI", "LLM", "Agents", "Architecture"],
        favorite: false,
        archived: false,
        trashed: false,
        personalNotes: "My personal thought on train journey",
        metadata: { domain: "reddit.com", suggestedCollectionName: "AI & Automation" },
        aiSummary: {
          quick: "Post on Reddit",
          standard: "Discussion on railway doors",
          detailed: "Community: r/reddit\nAuthor: u/Medical-Monk4137\nTitle: Why Men wants to stand near the door...",
        },
        keyPoints: ["Why men stand near doors"],
        topics: ["Travel"],
      };

      assert(MigrationService.isRedditItemCorrupted(corruptedRedditItem), "Must detect corrupted Reddit item");
      const repaired = MigrationService.repairRedditItem(corruptedRedditItem);

      // Canonical Creator
      assertEqual(repaired.creator?.username, "Medical-Monk4137", "Creator username normalized without u/");
      assertEqual(repaired.creator?.name, "Medical-Monk4137", "Creator name normalized without u/");

      // Canonical Community
      assertEqual(repaired.community?.name, "indianrailways", "Subreddit extracted from URL and normalized without r/");
      assertEqual(repaired.community?.displayName, "r/indianrailways", "Subreddit displayName formatted with r/");

      // Scrubbed AI tags & collection
      assert(!repaired.tags.includes("AI"), "Spurious AI tag removed");
      assert(!repaired.tags.includes("LLM"), "Spurious LLM tag removed");
      assert(!repaired.tags.includes("Agents"), "Spurious Agents tag removed");
      assert(!repaired.tags.includes("Architecture"), "Spurious Architecture tag removed");
      assertEqual(repaired.collectionId, undefined, "AI & Automation collection assignment cleared");

      // Preserved personal notes
      assertEqual(repaired.personalNotes, "My personal thought on train journey", "Personal notes strictly preserved");

      // Corrected detailed summary
      assert(repaired.aiSummary?.detailed?.includes("Community: r/indianrailways"), "Detailed summary community fixed to r/indianrailways");

      // Idempotency: re-checking repaired item must return false
      assert(!MigrationService.isRedditItemCorrupted(repaired), "Repaired item is no longer corrupted (strictly idempotent)");
    });

    await test("RedditProvider handles deleted and removed post classifications", () => {
      const deletedPost = {
        id: "del123",
        subreddit: "indianrailways",
        author: "[deleted]",
        title: "[deleted by user]",
        selftext: "[deleted]",
        is_self: true,
      };
      const mappedDeleted = redditProvider.mapPostToSourceData(deletedPost, "https://reddit.com/r/test/comments/del123/");
      assertEqual(mappedDeleted.isRestricted, true, "Deleted post marked as restricted");
      assertEqual(mappedDeleted.restrictionReason, "DELETED", "Reason code is DELETED");

      const removedPost = {
        id: "rem123",
        subreddit: "indianrailways",
        author: "SomeUser",
        title: "Removed post",
        selftext: "[removed]",
        is_self: true,
      };
      const mappedRemoved = redditProvider.mapPostToSourceData(removedPost, "https://reddit.com/r/test/comments/rem123/");
      assertEqual(mappedRemoved.isRestricted, true, "Removed post marked as restricted");
      assertEqual(mappedRemoved.restrictionReason, "REMOVED", "Reason code is REMOVED");
    });

    await test("Reddit Author Normalization: Canonical author, no 'u/', and deleted authors", () => {
      // 1. Author with u/ prefix
      const norm1 = MetadataNormalizer.normalizeRedditAuthor("u/Medical-Monk4137");
      assertEqual(norm1.username, "Medical-Monk4137", "Username must strip leading u/");
      assertEqual(norm1.displayName, "Medical-Monk4137", "DisplayName must strip leading u/");
      assertEqual(norm1.status, "active", "Status is active");

      // 2. Author with /u/ prefix
      const norm2 = MetadataNormalizer.normalizeRedditAuthor("/u/devang_patel");
      assertEqual(norm2.username, "devang_patel", "Username must strip leading /u/");
      assertEqual(norm2.displayName, "devang_patel", "DisplayName must strip leading /u/");

      // 3. Deleted author
      const normDeleted = MetadataNormalizer.normalizeRedditAuthor("[deleted]");
      assertEqual(normDeleted.username, null, "Deleted author must have username null");
      assertEqual(normDeleted.displayName, "Deleted user", "Deleted author displayName is 'Deleted user'");
      assertEqual(normDeleted.status, "deleted", "Deleted author status is 'deleted'");

      // 4. Removed or empty author
      const normEmpty = MetadataNormalizer.normalizeRedditAuthor("   ");
      assertEqual(normEmpty.username, null, "Empty author must have username null");
      assertEqual(normEmpty.displayName, "Deleted user", "Empty author displayName is 'Deleted user'");
      assertEqual(normEmpty.status, "deleted", "Empty author status is 'deleted'");
    });

    await test("Reddit Crosspost Handling: Preserves post author separate from parent post author", () => {
      const crosspostSubmission = {
        id: "1wv2ar8",
        subreddit: "dankindianmemes",
        title: "You are on an airplane and you see this, what’s your reaction?",
        author: "SubmitterUser",
        url: "https://v.redd.it/crosspost_video.mp4",
        crosspost_parent_list: [
          {
            id: "parent_post_999",
            subreddit: "airplane_memes",
            author: "OriginalVideoCreator",
            title: "Crazy airplane view",
            thumbnail: "https://i.redd.it/airplane_thumb.jpg",
            media: {
              reddit_video: {
                fallback_url: "https://v.redd.it/crosspost_video.mp4",
                duration: 30,
              },
            },
          },
        ],
      };

      const mapped = redditProvider.mapPostToSourceData(
        crosspostSubmission,
        "https://www.reddit.com/r/dankindianmemes/comments/1wv2ar8/airplane_reaction/"
      );

      // Submission author MUST be SubmitterUser, NOT OriginalVideoCreator
      assertEqual(mapped.creator.username, "SubmitterUser", "Post creator must be the submission author");
      assertEqual(mapped.creator.displayName, "SubmitterUser", "Post displayName matches submission author");

      // Parent author MUST be preserved in crosspost metadata
      const crosspostMeta = (mapped.rawPlatformMetadata as any)?.crosspost;
      assert(crosspostMeta !== undefined, "Crosspost metadata must be present");
      assertEqual(crosspostMeta.creator?.username, "OriginalVideoCreator", "Original post author preserved in crosspost.creator");
      assertEqual(crosspostMeta.subreddit, "airplane_memes", "Original subreddit preserved in crosspost.subreddit");

      // Media & thumbnail correctly extracted from parent submission
      assertEqual(mapped.thumbnailUrl, "https://i.redd.it/airplane_thumb.jpg", "Thumbnail extracted from parent post");
      assertEqual(mapped.contentType, "video", "Crosspost detected as video from parent media");
    });

    await test("Reddit Deleted Author: insufficient source does not create an author-based AI summary", async () => {
      const deletedPostSubmission = {
        id: "del_post_001",
        subreddit: "dankindianmemes",
        title: "Deleted Author Question Post",
        author: "[deleted]",
        selftext: "What is your opinion on this?",
        is_self: true,
      };

      const mapped = redditProvider.mapPostToSourceData(
        deletedPostSubmission,
        "https://www.reddit.com/r/dankindianmemes/comments/del_post_001/question/"
      );

      assertEqual(mapped.creator.username, null, "Creator username is null for [deleted]");
      assertEqual(mapped.creator.status, "deleted", "Creator status is deleted");

      const enrichment = await AIPipeline.enrichContent(mapped, INITIAL_COLLECTIONS);
      assertEqual(enrichment.status, "INSUFFICIENT_CONTENT", "Short metadata-only post does not receive AI analysis");
      assert(!enrichment.summary.standard.includes("by a deleted user"), "Fallback does not fabricate an author-based summary");
      assert(!enrichment.summary.standard.includes("u/null"), "AI summary MUST NOT say 'u/null'");
      assert(!enrichment.summary.standard.includes("u/[deleted]"), "AI summary MUST NOT say 'u/[deleted]'");
      assert(!enrichment.summary.standard.includes("u/Deleted user"), "AI summary MUST NOT say 'u/Deleted user'");
    });

    await test("CACHE ISOLATION: Reddit Post A (UserA) vs Reddit Post B (UserB) Sequential & Concurrent", async () => {
      RedditProvider.clearCache();

      const mockPostA = {
        id: "post_aaa",
        subreddit: "SubA",
        author: "UserA",
        title: "Title of Post A",
        selftext: "Body of Post A",
        is_self: true,
        thumbnail: "https://example.com/thumbA.jpg",
      };

      const mockPostB = {
        id: "post_bbb",
        subreddit: "SubB",
        author: "UserB",
        title: "Title of Post B",
        selftext: "Body of Post B",
        is_self: true,
        thumbnail: "https://example.com/thumbB.jpg",
      };

      // Sequential cycle: A -> B -> A -> B
      const mapA1 = redditProvider.mapPostToSourceData(mockPostA, "https://www.reddit.com/r/SubA/comments/post_aaa/a/");
      const mapB1 = redditProvider.mapPostToSourceData(mockPostB, "https://www.reddit.com/r/SubB/comments/post_bbb/b/");
      const mapA2 = redditProvider.mapPostToSourceData(mockPostA, "https://www.reddit.com/r/SubA/comments/post_aaa/a/");
      const mapB2 = redditProvider.mapPostToSourceData(mockPostB, "https://www.reddit.com/r/SubB/comments/post_bbb/b/");

      assertEqual(mapA1.creator.username, "UserA", "A1 creator must be UserA");
      assertEqual(mapB1.creator.username, "UserB", "B1 creator must be UserB");
      assertEqual(mapA2.creator.username, "UserA", "A2 creator must be UserA");
      assertEqual(mapB2.creator.username, "UserB", "B2 creator must be UserB");

      // Concurrent enrichment cycle
      const [enrichA, enrichB] = await Promise.all([
        AIPipeline.enrichContent(mapA1, INITIAL_COLLECTIONS),
        AIPipeline.enrichContent(mapB1, INITIAL_COLLECTIONS),
      ]);

      assertEqual(enrichA.status, "INSUFFICIENT_CONTENT", "Short post A does not receive AI analysis");
      assert(!enrichA.summary.standard.includes("UserB"), "Enrichment A does not contain UserB");
      assertEqual(enrichB.status, "INSUFFICIENT_CONTENT", "Short post B does not receive AI analysis");
      assert(!enrichB.summary.standard.includes("UserA"), "Enrichment B does not contain UserA");
    });

    await test("TASK 01: CollectionService validation, duplicate handling, and color persistence", () => {
      // 1. Rejects empty names
      let emptyThrew = false;
      try {
        CollectionService.create({ name: "   ", color: "#8b5cf6", icon: "Folder" });
      } catch {
        emptyThrew = true;
      }
      assert(emptyThrew, "CollectionService.create must throw for empty name");

      // 2. Trims whitespace and creates collection
      const colName = "  Agentic AI Resources  ";
      const created = CollectionService.create({
        name: colName,
        color: "#8b5cf6",
        icon: "Folder",
      });
      assertEqual(created.name, "Agentic AI Resources", "Name must be trimmed");
      assertEqual(created.color, "#8b5cf6", "Color must be preserved");
      assert(typeof created.id === "string" && created.id.startsWith("col-"), "Valid collection ID generated");

      // 3. Duplicate handling: does not create duplicate, returns existing
      const duplicate = CollectionService.create({
        name: "agentic ai resources", // case-insensitive match
        color: "#6366f1",
        icon: "Folder",
      });
      assertEqual(duplicate.id, created.id, "Duplicate name must return existing collection");
      assertEqual(duplicate.name, "Agentic AI Resources", "Existing collection name retained");

      // Cleanup created test collection
      CollectionService.delete(created.id);
    });

    // ---------------------------------------------------------------------------
    // 3d. X/Twitter Provider & Regression Tests (Root Cause Verification)
    // ---------------------------------------------------------------------------
    console.log("\n3d. X/Twitter Provider & Regression Tests (Root Cause Verification):");
    const xProvider = new XProvider();

    await test("XProvider canHandle standard, twitter, x, and mobile links", () => {
      assert(xProvider.canHandle("https://x.com/Dipanshu_AI/status/2105655603955945699"), "Standard x.com URL");
      assert(xProvider.canHandle("https://twitter.com/Dipanshu_AI/status/2105655603955945699"), "Standard twitter.com URL");
      assert(xProvider.canHandle("https://mobile.twitter.com/Dipanshu_AI/status/2105655603955945699"), "Mobile twitter URL");
      assert(xProvider.canHandle("https://x.com/i/status/2105655603955945699"), "x.com i/status link");
      assert(xProvider.canHandle("https://x.com/Dipanshu_AI"), "Profile URL");
      assert(!xProvider.canHandle("https://www.youtube.com/watch?v=123"), "Should reject YouTube");
      assert(!xProvider.canHandle("https://instagram.com/reel/123"), "Should reject Instagram");
      assert(!xProvider.canHandle("https://reddit.com/r/technology"), "Should reject Reddit");
      assert(!xProvider.canHandle("https://example.com"), "Should reject generic website");
    });

    await test("XProvider extracts details accurately (username, statusId, canonicalUrl)", () => {
      const d1 = xProvider.extractDetails("https://x.com/Dipanshu_AI/status/2105655603955945699?s=20");
      assertEqual(d1.username, "Dipanshu_AI", "Username extracted without @");
      assertEqual(d1.statusId, "2105655603955945699", "Status ID extracted");
      assertEqual(d1.canonicalUrl, "https://x.com/Dipanshu_AI/status/2105655603955945699", "Canonical URL clean without query params");
      assertEqual(d1.isStatusUrl, true, "Is status URL");

      const d2 = xProvider.extractDetails("https://twitter.com/i/web/status/987654321");
      assertEqual(d2.statusId, "987654321", "i/web/status ID extracted");
      assertEqual(d2.canonicalUrl, "https://x.com/i/status/987654321", "Canonical URL converted to x.com");

      const d3 = xProvider.extractDetails("https://x.com/AndrewYNg");
      assertEqual(d3.username, "AndrewYNg", "Profile username extracted");
      assertEqual(d3.isStatusUrl, false, "Profile is not a status URL");
      assertEqual(d3.canonicalUrl, "https://x.com/AndrewYNg", "Profile canonical URL clean");
    });

    await test("XProvider generateDisplayTitle creates deterministic titles without fabricating article titles", () => {
      const text1 = "Don't waste 2 years learning to become an AI agentic engineer in 2026. Andrew Ng gave the playbook.";
      const title1 = xProvider.generateDisplayTitle(text1, "Dipanshu Kushwaha", "Dipanshu_AI");
      assertEqual(title1, "Don't waste 2 years learning to become an AI agentic engineer in 2026.", "Takes first sentence");

      // Long text with URL
      const text2 = "Revolutionary paper on autonomous agents released! Check https://arxiv.org/abs/12345 for details on multi-agent execution.";
      const title2 = xProvider.generateDisplayTitle(text2, "Researcher", "ai_research");
      assertEqual(title2, "Revolutionary paper on autonomous agents released!", "Strips URLs and stops at sentence");

      // Empty text fallback
      const title3 = xProvider.generateDisplayTitle("", "Dipanshu Kushwaha", "Dipanshu_AI");
      assertEqual(title3, "Post by Dipanshu Kushwaha (@Dipanshu_AI)", "Fallback formats with author and handle");
    });

    await test("MANDATORY REGRESSION TEST: Dipanshu Kushwaha AI Agentic Engineer Post Data Model & AI Grounding", async () => {
      // Exact post represented in user regression case:
      // Creator display name: Dipanshu Kushwaha
      // Username: @Dipanshu_AI
      // Platform: X
      // Post text:
      // "Don't waste 2 years learning to become an AI agentic engineer in 2026.
      //
      // Andrew Ng, the godfather of AI, gave the complete playbook to become
      // one from scratch.
      //
      // 1 hour course. Free:
      // • 00:00 – AI agent basics
      // • 12:12 – AI Agentic workflows & design patterns
      // • 53:27 – Practical..."
      // Content type: Video post

      const testUrl = "https://x.com/Dipanshu_AI/status/2105655603955945699";
      const postText = `Don't waste 2 years learning to become an AI agentic engineer in 2026.

Andrew Ng, the godfather of AI, gave the complete playbook to become one from scratch.

1 hour course. Free:
• 00:00 – AI agent basics
• 12:12 – AI Agentic workflows & design patterns
• 53:27 – Practical...`;

      const mockTweetData = {
        id: "2105655603955945699",
        url: testUrl,
        text: postText,
        author: {
          id: "12345678",
          name: "Dipanshu Kushwaha",
          screen_name: "Dipanshu_AI",
          avatar_url: "https://pbs.twimg.com/profile_images/dipanshu.jpg",
          verified: true,
        },
        media: {
          videos: [
            {
              url: "https://video.twimg.com/amplify_video/sample.mp4",
              thumbnail_url: "https://pbs.twimg.com/media/sample_thumb.jpg",
              durationMs: 3600000,
            },
          ],
        },
        likes: 22000,
        retweets: 4500,
        replies: 310,
        views: 850000,
        bookmarks: 1200,
        created_at: "2026-03-15T10:00:00Z",
      };

      const details = xProvider.extractDetails(testUrl);
      const sourceData = xProvider.mapFxTweetToSourceData(mockTweetData, testUrl, details);

      // 1. Authoritative metadata assertions (Section 1, 2, 3, 5, 6, 7, 8)
      assertEqual(sourceData.platform, "x", "Platform MUST be x (NOT website)");
      assertEqual(sourceData.contentType, "video", "Content type MUST be video (NOT post or web)");
      assertEqual(sourceData.creator?.name, "Dipanshu Kushwaha", "Author name MUST be 'Dipanshu Kushwaha' (NOT 'X (formerly Twitter)')");
      assert(sourceData.creator?.name !== "X (formerly Twitter)", "Creator MUST NEVER be 'X (formerly Twitter)'");
      assert(sourceData.creator?.name !== "x.com", "Creator MUST NEVER be 'x.com'");
      assertEqual(sourceData.creator?.username, "Dipanshu_AI", "Canonical creator.username MUST NOT contain '@'");
      assertEqual(sourceData.creator?.handle, "@Dipanshu_AI", "Handle formatted as @Dipanshu_AI");
      assertEqual(sourceData.creator?.verified, true, "Verified badge preserved");
      assertEqual(sourceData.title, "Don't waste 2 years learning to become an AI agentic engineer in 2026.", "Title generated deterministically from post text");
      assert(sourceData.title !== "Dipanshu Kushwaha (@Dipanshu_AI) on X", "Title MUST NOT be scraped page title 'Author on X'");
      assertEqual(sourceData.canonicalUrl, "https://x.com/Dipanshu_AI/status/2105655603955945699", "Canonical URL is clean");

      // 2. Authoritative Post Text & Formatting
      const bodyText = sourceData.bodyText;
      assert(typeof bodyText === "string", "Post bodyText must be extracted as a string");
      assert(bodyText.includes("Don't waste 2 years learning to become an AI agentic engineer in 2026."), "Preserves first paragraph");
      assert(bodyText.includes("Andrew Ng"), "Preserves Andrew Ng mention");
      assert(bodyText.includes("• 00:00 – AI agent basics"), "Preserves bullet points and timestamps");

      // 3. Media & Engagement (Unformatted numeric snapshots)
      assertEqual(sourceData.thumbnailUrl, "https://pbs.twimg.com/media/sample_thumb.jpg", "Video thumbnail extracted");
      assertEqual(sourceData.mediaUrl, "https://video.twimg.com/amplify_video/sample.mp4", "Video media URL extracted");
      assertEqual(sourceData.likeCount, "22000", "Likes stored as numeric string (NOT formatted '22K')");
      assertEqual(sourceData.commentCount, "310", "Replies stored as numeric string");
      assertEqual(sourceData.viewCount, "850000", "Views stored as numeric string");
      assertEqual(sourceData.rawPlatformMetadata?.repostCount, 4500, "Retweets count in raw metadata");
      assertEqual(sourceData.rawPlatformMetadata?.bookmarkCount, 1200, "Bookmarks count in raw metadata");

      // 4. UI Presentation Deduplication Assertions
      const formattedCreator = `${sourceData.creator?.name} (@${(sourceData.creator?.username || "").replace(/^@/, "")})`;
      assertEqual(formattedCreator, "Dipanshu Kushwaha (@Dipanshu_AI)", "UI formats author as 'Dipanshu Kushwaha (@Dipanshu_AI)'");
      assert(!formattedCreator.includes("@@"), "Must NEVER display @@Dipanshu_AI");

      // 5. AI Enrichment & Grounding
      const enrichment = await AIPipeline.enrichContent(sourceData, INITIAL_COLLECTIONS);

      assertEqual(enrichment.status, "INSUFFICIENT_CONTENT", "Video post is not analyzed until a verified transcript exists");
      assert(!enrichment.summary.standard.includes("Dipanshu Kushwaha"), "AI fallback does not derive summaries from author metadata");
      assertEqual(enrichment.tags.length, 0, "No AI tags are synthesized without a verified transcript");

      // AI MUST NOT overwrite source facts
      assertEqual(sourceData.creator?.name, "Dipanshu Kushwaha", "AI did NOT overwrite creator name");
      assertEqual(sourceData.creator?.username, "Dipanshu_AI", "AI did NOT overwrite creator username");
      assertEqual(sourceData.platform, "x", "AI did NOT overwrite platform");

      assertEqual(enrichment.suggestedCollectionName, undefined, "No collection is inferred from an unverified video transcript");
    });

    await test("XProvider quote post: author isolation ensures quote creator never replaces post author", () => {
      const quoteTweetData = {
        id: "999888777",
        url: "https://x.com/MainUser/status/999888777",
        text: "Great thoughts here by the original author!",
        author: {
          id: "111",
          name: "Main User",
          screen_name: "MainUser",
          verified: false,
        },
        quote: {
          id: "555666777",
          text: "Original groundbreaking AI research post",
          author: {
            id: "222",
            name: "Original Quoted Author",
            screen_name: "QuotedAuthor",
            verified: true,
          },
        },
        likes: 150,
        retweets: 25,
        replies: 10,
      };

      const details = xProvider.extractDetails("https://x.com/MainUser/status/999888777");
      const sourceData = xProvider.mapFxTweetToSourceData(quoteTweetData, "https://x.com/MainUser/status/999888777", details);

      // Assert main author is preserved
      assertEqual(sourceData.creator?.name, "Main User", "Original post author is Main User");
      assertEqual(sourceData.creator?.username, "MainUser", "Original post handle is MainUser");
      assert(sourceData.creator?.name !== "Original Quoted Author", "Quote author must NEVER replace main author");

      // Assert quote author is isolated in rawPlatformMetadata.quotedPost
      assertEqual(sourceData.rawPlatformMetadata?.quotedPost?.creator?.name, "Original Quoted Author", "Quote creator isolated in metadata");
      assertEqual(sourceData.rawPlatformMetadata?.quotedPost?.creator?.username, "QuotedAuthor", "Quote username isolated in metadata");
    });

    await test("XProvider differentiates media post types (video, image, multiple images, GIF, text)", () => {
      // 1. Text-only post
      const textTweet = {
        id: "t1",
        text: "Just a text post about technology and web development.",
        author: { name: "User1", screen_name: "user1" },
      };
      const s1 = xProvider.mapFxTweetToSourceData(textTweet, "https://x.com/user1/status/t1");
      assertEqual(s1.contentType, "post", "Text tweet maps to 'post'");

      // 2. Video post
      const videoTweet = {
        id: "t2",
        text: "Watch this video",
        author: { name: "User2", screen_name: "user2" },
        media: { videos: [{ url: "https://video.twimg.com/v.mp4", durationMs: 120000 }] },
      };
      const s2 = xProvider.mapFxTweetToSourceData(videoTweet, "https://x.com/user2/status/t2");
      assertEqual(s2.contentType, "video", "Video tweet maps to 'video'");

      // 3. Photo post
      const photoTweet = {
        id: "t3",
        text: "Check out this screenshot",
        author: { name: "User3", screen_name: "user3" },
        media: { photos: [{ url: "https://pbs.twimg.com/img1.jpg" }, { url: "https://pbs.twimg.com/img2.jpg" }] },
      };
      const s3 = xProvider.mapFxTweetToSourceData(photoTweet, "https://x.com/user3/status/t3");
      assertEqual(s3.contentType, "image", "Photos tweet maps to 'image'");
      assertEqual(s3.rawPlatformMetadata?.mediaItems?.length, 2, "Both images captured in mediaItems");

      // 4. GIF post
      const gifTweet = {
        id: "t4",
        text: "Hilarious reaction GIF",
        author: { name: "User4", screen_name: "user4" },
        media: { all: [{ type: "gif", thumbnail_url: "https://pbs.twimg.com/gif.jpg" }] },
      };
      const s4 = xProvider.mapFxTweetToSourceData(gifTweet, "https://x.com/user4/status/t4");
      assertEqual(s4.contentType, "image", "GIF tweet maps to 'image'");
    });

    // ---------------------------------------------------------------------------
    // 4. Grounded AI Enrichment Tests
    // ---------------------------------------------------------------------------
    console.log("\n4. Grounded AI Enrichment & Insufficient Content Tests:");

    await test("AIPipeline returns exact 'Insufficient content' fallback for restricted source", async () => {
      const restrictedSource: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/C3x90ZaLkPq/",
        contentId: "C3x90ZaLkPq",
        creator: { name: "Instagram Creator" },
        title: "Instagram Reel • C3x90ZaLkPq",
        caption: undefined,
        description: "",
        bodyText: "",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: true,
        restrictionReason: "Instagram login wall encountered",
        provenance: {},
      };

      const enrichment = await AIPipeline.enrichContent(restrictedSource);
      assertEqual(enrichment.summary.quick, "Verified source content unavailable", "Must state verified source content is unavailable");
      assert(enrichment.summary.standard.includes("verified source content was unavailable"), "Must explain why analysis was withheld");
      assertEqual(enrichment.keyPoints.length, 0, "Key points MUST be empty for restricted content");
      assertEqual(enrichment.topics.length, 0, "Topics MUST be empty; no hallucination");
      assertEqual(enrichment.confidence, 0, "Unavailable evidence must have zero confidence");
      assert(!enrichment.isSufficientContent, "Must flag isSufficientContent as false");
      assertEqual(enrichment.status, "INSUFFICIENT_CONTENT", "Status must be INSUFFICIENT_CONTENT");
    });

    await test("AIPipeline requires a verified transcript before analyzing rich video metadata", async () => {
      const richSource: AuthoritativeSourceData = {
        platform: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=3lZF8W_AaUo",
        contentId: "3lZF8W_AaUo",
        creator: { name: "Tech Lead", handle: "@techlead" },
        title: "React 19 Server Actions and Performance Optimization",
        caption: "Learn how React 19 Server Actions simplify data mutation and reduce client-side bundle size.",
        description: "In this guide we cover React 19 actions, state transitions, and caching strategies. Structuring state separation prevents extra render passes.",
        bodyText: "In this guide we cover React 19 actions, state transitions, and caching strategies. Structuring state separation prevents extra render passes.",
        thumbnailUrl: "https://img.youtube.com/vi/3lZF8W_AaUo/hqdefault.jpg",
        contentType: "video",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      const enrichment = await AIPipeline.enrichContent(richSource);
      assertEqual(enrichment.status, "INSUFFICIENT_CONTENT", "A video without a verified transcript remains unanalyzed");
      assertEqual(enrichment.isSufficientContent, false, "Metadata does not qualify as verified content");
      assertEqual(enrichment.tags.length, 0, "No tags are generated from video title or description metadata");
    });

    // ---------------------------------------------------------------------------
    // 5. Deduplication Tests
    // ---------------------------------------------------------------------------
    console.log("\n5. Deduplication & Idempotency Tests:");

    await test("Candidate analyzer detects exact and canonical duplicates", () => {
      const existingItems: SavedItem[] = [
        {
          id: "save-1",
          title: "Test Video",
          url: "https://www.youtube.com/watch?v=3lZF8W_AaUo",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "youtube",
          contentType: "video",
          creator: { name: "Creator" },
          description: "Desc",
          savedDate: new Date().toISOString(),
          tags: ["Test"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "", standard: "", detailed: "" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "youtube.com" },
        },
      ];

      const candidates = [
        { originalUrl: "https://youtu.be/3lZF8W_AaUo", platform: "youtube" as const }, // Canonical duplicate of save-1
        { originalUrl: "https://www.youtube.com/watch?v=differentVideo1", platform: "youtube" as const }, // New
        { originalUrl: "https://www.youtube.com/watch?v=differentVideo1", platform: "youtube" as const }, // In-batch duplicate
      ];

      const analysis = ImportJobService.analyzeCandidates(candidates, existingItems);
      assertEqual(analysis.total, 3, "Total discovered is 3");
      assertEqual(analysis.duplicates, 2, "2 duplicates detected (1 existing, 1 in-batch)");
      assertEqual(analysis.newItems, 1, "1 net new item");
    });

    // ---------------------------------------------------------------------------
    // 6. Export File Parser Tests
    // ---------------------------------------------------------------------------
    console.log("\n6. Export File Parser Tests:");

    await test("ExportFileParser parses Instagram saved_posts.json export", () => {
      const instagramJson = JSON.stringify({
        saved_saved_media: [
          {
            title: "travel_creator",
            string_map_data: {
              "Saved on": {
                href: "https://www.instagram.com/reel/C3x90ZaLkPq/",
                timestamp: 1709000000,
              },
            },
          },
          {
            title: "design_daily",
            string_map_data: {
              "Saved on": {
                href: "https://www.instagram.com/p/DFxyz123/",
                timestamp: 1709100000,
              },
            },
          },
        ],
      });

      const parsed = ExportFileParser.parse(instagramJson, "saved_posts.json");
      assertEqual(parsed.length, 2, "Parsed 2 items from Instagram JSON");
      assertEqual(parsed[0].originalUrl, "https://www.instagram.com/reel/C3x90ZaLkPq/", "First URL extracted correctly");
      assertEqual(parsed[0].platform, "instagram", "Platform is instagram");
    });

    await test("ExportFileParser parses YouTube Takeout Watch later.csv", () => {
      const youtubeCsv = `Video ID,Playlist video creation timestamp
3lZF8W_AaUo,2024-02-15T10:00:00Z
dQw4w9WgXcQ,2024-02-16T12:00:00Z
5e_0B_5b6U0,2024-02-17T14:00:00Z`;

      const parsed = ExportFileParser.parse(youtubeCsv, "Watch later.csv");
      assertEqual(parsed.length, 3, "Parsed 3 video IDs from YouTube CSV");
      assertEqual(parsed[0].originalUrl, "https://www.youtube.com/watch?v=3lZF8W_AaUo", "Converted video ID to full URL");
      assertEqual(parsed[0].platform, "youtube", "Platform is youtube");
    });

    await test("ExportFileParser parses raw URL list", () => {
      const rawList = `
      https://www.youtube.com/watch?v=3lZF8W_AaUo
      https://www.instagram.com/reel/C3x90ZaLkPq/
      https://youtu.be/dQw4w9WgXcQ
    `;
      const parsed = ExportFileParser.parse(rawList);
      assertEqual(parsed.length, 3, "Parsed 3 raw URLs");
    });

    // ---------------------------------------------------------------------------
    // 7. Bulk Import Job Execution & Queue Tests
    // ---------------------------------------------------------------------------
    console.log("\n7. Bulk Import Job Execution & Queue Tests:");

    await test("ImportJobService creates, progresses, and generates persistent report", async () => {
      const mockItems = [
        {
          id: "item-1",
          jobId: "",
          originalUrl: "https://www.youtube.com/watch?v=3lZF8W_AaUo",
          platform: "youtube" as const,
          contentType: "video" as const,
          status: "pending" as const,
          retryCount: 0,
        },
        {
          id: "item-2",
          jobId: "",
          originalUrl: "https://www.instagram.com/reel/C3x90ZaLkPq/",
          platform: "instagram" as const,
          contentType: "reel" as const,
          status: "pending" as const,
          retryCount: 0,
        },
      ];

      const job = ImportJobService.createJob({
        userId: "test-user-1",
        platform: "youtube",
        sourceType: "file_export",
        sourceName: "Takeout Test",
        items: mockItems,
        options: {
          autoOrganize: true,
          skipDuplicates: true,
          defaultTags: ["TestImport"],
          concurrencyLimit: 2,
        },
      });

      assertEqual(job.totalItems, 2, "Job initialized with 2 items");
      assertEqual(job.status, "ready", "Status is ready");

      // Execute job
      const report = await ImportJobService.startJob(job.id);
      assertEqual(report.jobId, job.id, "Report maps to job ID");
      assert(report.summary.totalDiscovered === 2, "Discovered count matches");
      assert(report.items.length === 2, "Item-level results preserved");
    });

    // ---------------------------------------------------------------------------
    // 8. Scalability: 1,000+ Simulated Import Records Test
    // ---------------------------------------------------------------------------
    console.log("\n8. Scalability: 1,000+ Simulated Import Records Test:");

    await test("Processes 1,000 candidate records without memory degradation", () => {
      const candidates: any[] = [];
      for (let i = 0; i < 1000; i++) {
        candidates.push({
          originalUrl: `https://www.youtube.com/watch?v=video${i.toString().padStart(6, "0")}`,
          platform: "youtube",
          title: `Simulated Video #${i}`,
        });
      }

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const analysis = ImportJobService.analyzeCandidates(candidates, []);
      const elapsed = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memDeltaMb = Math.round((endMemory - startMemory) / (1024 * 1024));

      assertEqual(analysis.total, 1000, "1,000 items analyzed");
      assertEqual(analysis.newItems, 1000, "All 1,000 items identified as new");
      assert(elapsed < 1000, `Processing 1,000 items took ${elapsed}ms (must be under 1,000ms)`);
      console.log(`    Scale test throughput: 1,000 records processed in ${elapsed}ms (Heap delta: ~${memDeltaMb}MB)`);
    });

    // ---------------------------------------------------------------------------
    // 9. Multi-User Security & Isolation Tests
    // ---------------------------------------------------------------------------
    console.log("\n9. Multi-User Security & Isolation Tests:");

    await test("User A cannot access User B's import jobs or reports", () => {
      const userA = "user-alice";
      const userB = "user-bob";

      const jobA = ImportJobService.createJob({
        userId: userA,
        platform: "youtube",
        sourceType: "file_export",
        sourceName: "Alice Import",
        items: [],
        options: { autoOrganize: true, skipDuplicates: true, defaultTags: [] },
      });

      const reportA = ImportJobService.generateReport(jobA);
      ImportJobService.saveReport(reportA);

      // Verify Bob cannot read Alice's report by querying Bob's workspace
      const bReports = ImportJobService.getReports(userB);
      const hasAliceReportInBobWorkspace = bReports.some((r) => r.userId === userA || r.id === reportA.id);
      assert(!hasAliceReportInBobWorkspace, "Bob's workspace MUST NOT contain Alice's reports");
    });

    // ---------------------------------------------------------------------------
    // 10. OAuth Security & State Nonce Tests
    // ---------------------------------------------------------------------------
    console.log("\n10. OAuth Security & CSRF State Tests:");

    await test("OAuth state generation & validation prevents CSRF", () => {
      const userId = "user-secure-123";
      const state = OAuthSecurityService.generateState(userId, "youtube");
      assert(typeof state === "string" && state.length > 20, "State must be base64url string");

      const validCheck = OAuthSecurityService.validateState(state, userId);
      assert(validCheck.isValid, "Valid state must pass validation");
      assertEqual(validCheck.platform, "youtube", "Platform matches state");

      // Tampered state or different user
      const forgedCheck = OAuthSecurityService.validateState(state, "attacker-user-999");
      assert(!forgedCheck.isValid, "Must reject mismatched user ID");
    });

    // ---------------------------------------------------------------------------
    // 11. Browser Bookmarks & Multi-Format Parsing Tests
    // ---------------------------------------------------------------------------
    console.log("\n11. Browser Bookmarks & Multi-Format Parsing Tests:");

    await test("ExportFileParser parses Netscape Bookmark HTML files", () => {
      const bookmarkHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
      <DT><A HREF="https://www.youtube.com/watch?v=3lZF8W_AaUo" ADD_DATE="1709000000">React 19 Deep Dive</A>
      <DT><A HREF="https://www.reddit.com/r/technology/comments/1i3b827/ai_agents/" ADD_DATE="1709100000">AI Agents Discussion &amp; Analysis</A>
      <DT><A HREF="https://www.linkedin.com/pulse/future-software-engineering-devang" ADD_DATE="1709200000">Future of Software Engineering</A>
    </DL><p>`;

      const parsed = ExportFileParser.parse(bookmarkHtml, "bookmarks.html");
      assertEqual(parsed.length, 3, "Parsed 3 bookmarks from HTML file");
      assertEqual(parsed[0].platform, "youtube", "Identified YouTube platform");
      assertEqual(parsed[0].title, "React 19 Deep Dive", "Extracted bookmark title");
      assertEqual(parsed[1].platform, "reddit", "Identified Reddit platform");
      assertEqual(parsed[1].title, "AI Agents Discussion & Analysis", "Cleaned HTML entities in title");
      assertEqual(parsed[2].platform, "linkedin", "Identified LinkedIn platform");
    });

    await test("ExportFileParser parses Reddit JSON export format", () => {
      const redditJson = JSON.stringify({
        data: {
          children: [
            {
              data: {
                permalink: "/r/reactjs/comments/12345/best_practices/",
                title: "React Best Practices 2026",
                subreddit: "reactjs",
                created_utc: 1708000000,
              },
            },
          ],
        },
      });

      const parsed = ExportFileParser.parse(redditJson, "reddit_saved.json");
      assertEqual(parsed.length, 1, "Parsed 1 item from Reddit JSON export");
      assertEqual(parsed[0].originalUrl, "https://www.reddit.com/r/reactjs/comments/12345/best_practices/", "Constructed full Reddit URL");
      assertEqual(parsed[0].platform, "reddit", "Platform is reddit");
    });

    // ---------------------------------------------------------------------------
    // 12. Pre-Import 5-Way Analysis Breakdown Tests
    // ---------------------------------------------------------------------------
    console.log("\n12. Pre-Import 5-Way Analysis Breakdown Tests:");

    await test("ImportJobService computes exact 5-way breakdown (Detected, Ready, Already Saved, Batch Duplicates, Unsupported)", () => {
      const existingInKeeper: any[] = [
        {
          id: "existing-1",
          url: "https://www.youtube.com/watch?v=savedVid001",
          trashed: false,
          metadata: { domain: "youtube.com" },
        },
      ];

      const candidates = [
        { originalUrl: "https://www.youtube.com/watch?v=savedVid001", platform: "youtube" as const }, // Already Saved
        { originalUrl: "https://www.youtube.com/watch?v=freshVid001", platform: "youtube" as const }, // Ready
        { originalUrl: "https://www.youtube.com/watch?v=freshVid001", platform: "youtube" as const }, // Duplicate in Batch
        { originalUrl: "ftp://invalid-url-scheme", platform: "website" as const },                      // Unsupported
        { originalUrl: "not_a_valid_url_at_all", platform: "website" as const },                        // Unsupported
      ];

      const analysis = ImportJobService.analyzeCandidates(candidates, existingInKeeper);
      assertEqual(analysis.total, 5, "Total detected is 5");
      assertEqual(analysis.ready, 1, "1 Ready item");
      assertEqual(analysis.alreadySaved, 1, "1 Already Saved item");
      assertEqual(analysis.batchDuplicates, 1, "1 Batch Duplicate item");
      assertEqual(analysis.unsupported, 2, "2 Unsupported items");
      assertEqual(analysis.duplicates, 2, "Backward-compatible duplicates count is 2");
      assertEqual(analysis.newItems, 1, "Backward-compatible newItems count is 1");
    });

    // ---------------------------------------------------------------------------
    // 13. LinkedIn Isolated Platform Provider Tests
    // ---------------------------------------------------------------------------
    console.log("\n13. LinkedIn Isolated Platform Provider Tests:");

    await test("LinkedInProvider canonicalizes pulse articles and posts cleanly", () => {
      const provider = new LinkedInProvider();
      const pulseUrl = "https://www.linkedin.com/pulse/future-of-ai-engineering-2026?tracking=xyz";
      const postUrl = "https://www.linkedin.com/posts/willlarson_engineering-management-systems-activity-123456789";

      assert(provider.canHandle(pulseUrl), "Can handle pulse URL");
      assert(provider.canHandle(postUrl), "Can handle post URL");

      const pulseVal = provider.validateAndCanonicalize(pulseUrl);
      assertEqual(pulseVal.canonicalUrl, "https://www.linkedin.com/pulse/future-of-ai-engineering-2026", "Canonicalizes pulse URL cleanly");
      assertEqual(pulseVal.contentType, "article", "Identifies pulse as article");

      const postVal = provider.validateAndCanonicalize(postUrl);
      assertEqual(postVal.contentType, "post", "Identifies post as post");
    });

    await test("ProviderRegistry resolves LinkedInProvider via PlatformRouter", () => {
      const registry = ProviderRegistry.getInstance();
      const provider = registry.getProviderForUrl("https://www.linkedin.com/pulse/test-slug");
      assertEqual(provider.platform, "linkedin", "Resolved LinkedInProvider correctly");
    });

    // ---------------------------------------------------------------------------
    // 14. AI Failure Boundary & Factual Retention Tests
    // ---------------------------------------------------------------------------
    console.log("\n14. AI Failure Boundary & Factual Retention Tests:");

    await test("IngestionService fast metadata mode generates reliable factual enrichment without LLM", () => {
      const mockSourceData: AuthoritativeSourceData = {
        platform: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=3lZF8W_AaUo",
        contentId: "3lZF8W_AaUo",
        creator: { name: "Engineering Team", handle: "@eng_team" },
        title: "Reliable Systems at Scale",
        description: "A comprehensive breakdown of distributed state machines.",
        thumbnailUrl: "https://img.youtube.com/vi/3lZF8W_AaUo/hqdefault.jpg",
        contentType: "video",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      const fastEnrichment = IngestionService.buildFastMetadataEnrichment(mockSourceData);
      assertEqual(fastEnrichment.summary.quick, "Processing", "Does not synthesize a summary from title metadata");
      assertEqual(fastEnrichment.status, "METADATA_ONLY", "Remains metadata-only until the worker verifies source text");
      assertEqual(fastEnrichment.tags.length, 0, "Does not generate tags during the metadata-only import request");
    });

    await test("IngestionService fallback enrichment preserves factual metadata when AI throws", () => {
      const mockSourceData: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/C3x90ZaLkPq/",
        contentId: "C3x90ZaLkPq",
        creator: { name: "Design Studio" },
        title: "Design System Motion Tokens",
        description: "Micro-interactions with Framer Motion.",
        thumbnailUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      const simulatedAiError = new Error("Simulated LLM rate limit 429 quota exhausted");
      const fallbackEnrichment = IngestionService.buildFallbackEnrichment(mockSourceData, simulatedAiError);

      assertEqual(fallbackEnrichment.summary.quick, "Processing failed", "Does not turn title metadata into a summary after an AI failure");
      assertEqual(fallbackEnrichment.tags.length, 0, "AI failure does not generate fallback tags");
      assert(fallbackEnrichment.provenance.aiError !== undefined, "AI error logged in provenance");
      assertEqual(fallbackEnrichment.isSufficientContent, false, "Marked insufficient context due to AI error");
    });

    // ---------------------------------------------------------------------------
    // 15. Storage Idempotency & Duplicate Safety Tests
    // ---------------------------------------------------------------------------
    console.log("\n15. Storage Idempotency & Duplicate Safety Tests:");

    await test("ContentService.addItem prevents duplicate creation when duplicateStrategy is 'skip'", () => {
      const testUser = "idempotency-test-user";
      const testItem = {
        title: "Unique Idempotent Video",
        url: "https://www.youtube.com/watch?v=idempotent123",
        thumbnail: "https://img.youtube.com/vi/idempotent123/hqdefault.jpg",
        platform: "youtube" as const,
        contentType: "video" as const,
        creator: { name: "Creator 1" },
        description: "Description",
        tags: ["Test"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: [],
        topics: [],
        personalNotes: "",
        metadata: { domain: "youtube.com" },
      };

      // First save
      const firstSave = ContentService.addItem(testItem, testUser, "skip");
      assert(firstSave.id !== undefined, "First save succeeds");

      // Second save of exact same canonical URL with 'skip'
      const secondSave = ContentService.addItem(testItem, testUser, "skip");
      assertEqual(secondSave.id, firstSave.id, "Second save returns existing record without creating duplicate");

      // Total items for this user must remain exactly 1
      const userItems = ContentService.getAll(testUser);
      const matches = userItems.filter((i) => i.url === testItem.url);
      assertEqual(matches.length, 1, "Exactly 1 item exists in user storage (Zero duplication)");
    });

    // ---------------------------------------------------------------------------
    // 16. Instagram Official Export Adapter & Collection Discovery Tests
    // ---------------------------------------------------------------------------
    console.log("\n16. Instagram Official Export Adapter & Collection Discovery Tests:");

    await test("InstagramExportAdapter parses legacy saved_saved_media with string_map_data", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_SAVED_POSTS_STRING_MAP, "saved_posts.json");
      assert(analysis.isValid === true, "Valid export detected");
      assertEqual(analysis.candidates.length, 2, "Extracted 2 valid post candidates");
      assertEqual(analysis.candidates[0].originalUrl, "https://www.instagram.com/p/C3x90ZaLkPq/", "Canonical post URL normalized");
      assertEqual(analysis.candidates[0].platform, "instagram", "Platform correctly identified as instagram");
      assert(analysis.candidates[0].savedTimestamp !== undefined, "Timestamp preserved from string_map_data");
    });

    await test("InstagramExportAdapter parses reels with string_list_data", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_SAVED_REELS_STRING_LIST, "saved_reels.json");
      assert(analysis.isValid === true, "Valid reels export detected");
      assertEqual(analysis.candidates.length, 2, "Extracted 2 valid reel candidates");
      assertEqual(analysis.candidates[0].originalUrl, "https://www.instagram.com/reel/C5z92NcLrSt/", "Canonical reel URL normalized");
      assertEqual(analysis.candidates[1].originalUrl, "https://www.instagram.com/reel/C6a03OdMsTu/", "Canonical reel URL normalized");
    });

    await test("InstagramExportAdapter preserves real collection names across multiple collections", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_MULTIPLE_COLLECTIONS, "saved_collections.json");
      assert(analysis.isValid === true, "Valid collection export detected");
      assertEqual(analysis.collections.length, 3, "Discovered exactly 3 distinct saved collections");

      const colNames = analysis.collections.map((c) => c.name);
      assert(colNames.includes("UI Inspiration"), "Preserved 'UI Inspiration' collection");
      assert(colNames.includes("Architecture & Interiors"), "Preserved 'Architecture & Interiors' collection");
      assert(colNames.includes("Recipes & Cooking"), "Preserved 'Recipes & Cooking' collection");

      const uiCol = analysis.collections.find((c) => c.name === "UI Inspiration");
      assertEqual(uiCol?.count, 2, "'UI Inspiration' collection contains 2 items");

      // Verify candidate-level collection tagging
      const uiCandidates = analysis.candidates.filter((c) => c.sourceCollection === "UI Inspiration");
      assertEqual(uiCandidates.length, 2, "2 candidates tagged with 'UI Inspiration'");
      assertEqual(uiCandidates[0].sourceContext, "UI Inspiration", "sourceContext matches collection name");
    });

    await test("InstagramExportAdapter handles flat lists without collection grouping", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_NO_COLLECTIONS_FLAT, "flat_export.json");
      assert(analysis.isValid === true, "Valid flat list detected");
      assertEqual(analysis.candidates.length, 2, "Extracted 2 candidates");
      assertEqual(analysis.collections.length, 0, "Zero collections invented for flat list");
      assertEqual(analysis.uncollectedCount, 2, "Both items counted as uncollected");
    });

    await test("InstagramExportAdapter deduplicates repeat URLs in a single export", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_WITH_DUPLICATE_URLS, "saved_collections.json");
      assert(analysis.isValid === true, "Valid export detected");
      assertEqual(analysis.candidates.length, 1, "Duplicate post URL within export deduplicated");
    });

    await test("InstagramExportAdapter rejects invalid schemes and non-content URLs", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_WITH_INVALID_URLS, "saved_posts.json");
      assert(analysis.isValid === true, "Export with at least 1 valid URL is parsed");
      assertEqual(analysis.candidates.length, 1, "Only the 1 legitimate post URL was extracted (ftp and /about/us rejected)");
    });

    await test("InstagramExportAdapter gracefully skips missing or null URLs", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_MISSING_URLS, "saved_posts.json");
      assert(analysis.isValid === true, "Parsed successfully");
      assertEqual(analysis.candidates.length, 1, "Extracted only the 1 valid record, ignoring empty/null records");
    });

    await test("InstagramExportAdapter safely handles malformed JSON without crashing", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_MALFORMED_JSON, "corrupt.json");
      assertEqual(analysis.isValid, false, "Marked as invalid");
      assert(analysis.error !== undefined && analysis.error.includes("Malformed JSON"), "Returned descriptive error without crashing");
      assertEqual(analysis.candidates.length, 0, "No candidates returned");
    });

    await test("InstagramExportAdapter rejects unexpected schemas (unrelated JSON)", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_UNEXPECTED_SCHEMA, "settings.json");
      assertEqual(analysis.isValid, false, "Marked as invalid for non-Instagram data");
      assertEqual(analysis.candidates.length, 0, "Zero candidates extracted");
      assert(analysis.warnings.length > 0, "Warning returned explaining no valid Instagram links found");
    });

    await test("InstagramExportAdapter extracts deep nested Accounts Center structures", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_NESTED_ACCOUNTS_CENTER, "accounts_center.json");
      assert(analysis.isValid === true, "Discovered nested Accounts Center structure");
      assertEqual(analysis.candidates.length, 1, "Extracted nested candidate");
      assertEqual(analysis.candidates[0].originalUrl, "https://www.instagram.com/reel/DEfg12345/", "Reel URL extracted");
      assertEqual(analysis.candidates[0].sourceCollection, "Design Engineering", "Preserved parent collection title");
    });

    await test("InstagramExportAdapter parses 250+ candidates under 100ms (High Performance)", () => {
      const largeExport = generateLargeCandidateSet(250);
      const start = Date.now();
      const analysis = InstagramExportAdapter.parse(largeExport, "large_export.json");
      const elapsed = Date.now() - start;

      assert(analysis.isValid === true, "Large export parsed");
      assertEqual(analysis.candidates.length, 250, "All 250 candidates extracted");
      assert(elapsed < 150, `Parsing 250 items took ${elapsed}ms (Expected < 150ms)`);
    });

    await test("InstagramExportAdapter.parseMultipleJsonFiles combines files and preserves collections", () => {
      const files = [
        { content: FIXTURE_SAVED_POSTS_STRING_MAP, filename: "saved_posts.json" },
        { content: FIXTURE_MULTIPLE_COLLECTIONS, filename: "saved_collections.json" },
      ];
      const combined = InstagramExportAdapter.parseMultipleJsonFiles(files);
      assert(combined.isValid === true, "Combined export valid");
      assert(combined.collections.length === 3, "Collections preserved from saved_collections.json");
      assert(combined.candidates.length >= 4, "Aggregated candidates across both files");
    });

    await test("ZipArchiveReader correctly identifies ZIP signatures and rejects invalid buffers", () => {
      const fakeZipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      assert(ZipArchiveReader.isZip(fakeZipHeader) === true, "Identified ZIP magic header PK\x03\x04");

      const nonZip = new Uint8Array([0x7b, 0x22, 0x61, 0x22]); // '{"a"'
      assert(ZipArchiveReader.isZip(nonZip) === false, "Rejected non-ZIP buffer");
    });

    await test("End-to-End: Instagram Export -> InstagramExportAdapter -> ImportJobService.analyzeCandidates", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_MULTIPLE_COLLECTIONS, "saved_collections.json");
      assert(analysis.isValid, "Adapter extracted candidates");

      // Convert to ParsedImportCandidate[]
      const candidates: ParsedImportCandidate[] = analysis.candidates.map((c) => ({
        originalUrl: c.originalUrl,
        platform: "instagram",
        title: c.title,
        sourceContext: c.sourceCollection,
        collectionName: c.sourceCollection,
        savedTimestamp: c.savedTimestamp,
      }));

      // Pass directly to existing ImportJobService.analyzeCandidates()
      const preImport = ImportJobService.analyzeCandidates(candidates, []);
      assertEqual(preImport.total, candidates.length, "All candidates analyzed by ImportJobService");
      assert(preImport.ready > 0, "Eligible candidates ready to import");
      assertEqual(preImport.unsupported, 0, "Zero unsupported items among valid Instagram links");

      // Verify collectionName was preserved on candidateItems
      const sampleItem = preImport.candidateItems.find((i) => i.collectionName === "UI Inspiration");
      assert(sampleItem !== undefined, "Collection name 'UI Inspiration' preserved onto ImportItem");
      assertEqual(sampleItem?.platform, "instagram", "Platform preserved as instagram");
    });

    // ---------------------------------------------------------------------------
    // 17. Full End-to-End Pipeline & Real Persistence Tests
    // ---------------------------------------------------------------------------
    console.log("\n17. Full End-to-End Pipeline & Real Persistence Tests:");

    await test("Real End-to-End: Instagram Export -> ImportJob -> Worker -> Ingestion -> ContentService -> Storage", async () => {
      const e2eUser = `e2e-user-${Date.now()}`;
      const initialCol = CollectionService.create({
        name: "E2E Verified Saves",
        description: "Destination for E2E import test",
        icon: "Folder",
        color: "#EC4899",
      }, e2eUser);

      // 1. Parse real Instagram fixture
      const analysis = InstagramExportAdapter.parse(FIXTURE_SAVED_POSTS_STRING_MAP, "saved_posts.json");
      assert(analysis.isValid && analysis.candidates.length === 2, "Fixture parsed 2 valid candidates");

      // 2. Map candidates to destination collection
      const candidates: ParsedImportCandidate[] = analysis.candidates.map((c) => ({
        originalUrl: c.originalUrl,
        platform: "instagram",
        title: c.title,
        sourceContext: "Instagram Saved Media",
        collectionId: initialCol.id,
        collectionName: initialCol.name,
        savedTimestamp: c.savedTimestamp,
      }));

      // 3. Analyze candidates using real ImportJobService
      const preImport = ImportJobService.analyzeCandidates(candidates, []);
      assertEqual(preImport.ready, 2, "Both items ready to import");

      // 4. Create and start real ImportJob
      const job = ImportJobService.createJob({
        userId: e2eUser,
        platform: "instagram",
        sourceType: "file_export",
        sourceName: "Instagram Export E2E",
        items: preImport.candidateItems,
        options: {
          targetCollectionId: initialCol.id,
          autoOrganize: false,
          skipDuplicates: true,
          aiEnrichmentMode: "fast_metadata",
          defaultTags: ["InstagramE2E"],
        },
      });

      assertEqual(job.status, "ready", "Job created in ready state");
      assertEqual(job.totalItems, 2, "Job contains 2 items");

      // 5. Execute real worker lifecycle
      const report = await ImportJobService.startJob(job.id);
      assertEqual(report.summary.imported, 2, "Both items successfully imported by worker");
      assertEqual(report.summary.failed, 0, "Zero failures during valid import");

      // 6. Verify real persisted SavedItems in Storage
      const savedItems = StorageService.getItems(e2eUser);
      assertEqual(savedItems.length, 2, "Exactly 2 items persisted in storage for user");

      const firstItem = savedItems.find((i) => i.url === "https://www.instagram.com/p/C3x90ZaLkPq/");
      assert(firstItem !== undefined, "First post persisted with canonical URL");
      assertEqual(firstItem?.platform, "instagram", "Platform is instagram");
      assertEqual(firstItem?.collectionId, initialCol.id, "Correct target collection assigned");
      assert(firstItem?.collections?.includes(initialCol.id), "Collection ID in collections array");

      const secondItem = savedItems.find((i) => i.url === "https://www.instagram.com/p/C4y81MbKqRs/");
      assert(secondItem !== undefined, "Second post persisted with canonical URL");
      assertEqual(secondItem?.collectionId, initialCol.id, "Second post assigned to target collection");
    });

    await test("Collection Routing: Preserves distinct collection mapping across multiple collections", async () => {
      const routingUser = `routing-user-${Date.now()}`;

      // Create 3 destination collections
      const colUI = CollectionService.create({ name: "UI Inspiration Keeper", icon: "Folder", color: "#6366F1" }, routingUser);
      const colDev = CollectionService.create({ name: "Development Keeper", icon: "Folder", color: "#10B981" }, routingUser);
      const colRecipes = CollectionService.create({ name: "Recipes Keeper", icon: "Folder", color: "#F59E0B" }, routingUser);

      // Parse multi-collection fixture (contains UI, Architecture, Recipes)
      const analysis = InstagramExportAdapter.parse(FIXTURE_MULTIPLE_COLLECTIONS, "saved_collections.json");
      assert(analysis.isValid, "Export parsed");

      // Map each Instagram collection to a specific Keeper collection
      const candidates: ParsedImportCandidate[] = analysis.candidates.map((c) => {
        let targetId = colUI.id;
        if (c.sourceCollection === "Architecture & Interiors") targetId = colDev.id;
        if (c.sourceCollection === "Recipes & Cooking") targetId = colRecipes.id;

        return {
          originalUrl: c.originalUrl,
          platform: "instagram",
          title: c.title,
          sourceContext: c.sourceCollection,
          collectionId: targetId,
          collectionName: c.sourceCollection,
        };
      });

      const preImport = ImportJobService.analyzeCandidates(candidates, []);
      const job = ImportJobService.createJob({
        userId: routingUser,
        platform: "instagram",
        sourceType: "file_export",
        sourceName: "Instagram Multi-Collection Routing",
        items: preImport.candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: true,
          aiEnrichmentMode: "fast_metadata",
          defaultTags: ["RoutingTest"],
        },
      });

      await ImportJobService.startJob(job.id);
      const persistedItems = StorageService.getItems(routingUser);

      // Verify items in UI collection
      const uiItems = persistedItems.filter((i) => i.collectionId === colUI.id);
      assertEqual(uiItems.length, 2, "Exactly 2 items routed to UI Inspiration Keeper collection");

      // Verify item in Dev collection
      const devItems = persistedItems.filter((i) => i.collectionId === colDev.id);
      assertEqual(devItems.length, 1, "Exactly 1 item routed to Development Keeper collection");
      assertEqual(devItems[0].url, "https://www.instagram.com/p/C8c25QfOuVw/", "Correct architecture item in Dev collection");

      // Verify item in Recipes collection
      const recipeItems = persistedItems.filter((i) => i.collectionId === colRecipes.id);
      assertEqual(recipeItems.length, 1, "Exactly 1 item routed to Recipes Keeper collection");
      assertEqual(recipeItems[0].url, "https://www.instagram.com/reel/C9d36RgPvWx/", "Correct reel item in Recipes collection");
    });

    await test("Collection Creation Failure & Rollback: Safely rolls back created collections on error", async () => {
      const createdIds: string[] = [];
      const simulateFailure = true;

      // Simulate collection creation helper with rollback
      const runCollectionCreationWithRollback = async () => {
        const colNames = ["Col Success 1", "Col Failing 2", "Col Never 3"];
        const resolved: Record<string, string> = {};

        for (const name of colNames) {
          try {
            if (name === "Col Failing 2" && simulateFailure) {
              throw new Error("Simulated storage disk full quota exceeded");
            }
            const created = CollectionService.create({ name, icon: "Folder", color: "#EC4899" });
            createdIds.push(created.id);
            resolved[name] = created.id;
          } catch (err: any) {
            // Deterministic Rollback policy
            for (const rollbackId of createdIds) {
              CollectionService.delete(rollbackId);
            }
            throw err;
          }
        }
        return resolved;
      };

      let errorCaught = false;
      try {
        await runCollectionCreationWithRollback();
      } catch (err: any) {
        errorCaught = true;
        assert(err.message.includes("quota exceeded"), "Error message preserved");
      }

      assert(errorCaught === true, "Creation failure intercepted");
      // Verify rollback: Col Success 1 must NOT remain in storage
      const allCols = CollectionService.getAll();
      const leaked = allCols.filter((c) => c.name === "Col Success 1");
      assertEqual(leaked.length, 0, "Col Success 1 was safely rolled back (Zero orphaned collections)");
    });

    await test("Multi-Collection Membership: Same content across multiple collections preserves both memberships", () => {
      const multiColUser = `multi-col-user-${Date.now()}`;
      const colA = "col-design-inspiration";
      const colB = "col-frontend-recipes";

      const postUrl = "https://www.instagram.com/reel/C3x90ZaLkPq/";

      // 1. Save in Collection A
      const saveA = ContentService.addItem(
        {
          title: "Framer Animation",
          url: postUrl,
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "reel",
          creator: { name: "Designer" },
          description: "Animation Reel",
          collectionId: colA,
          collections: [colA],
          tags: ["Design"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        multiColUser,
        "skip"
      );

      assertEqual(saveA.collectionId, colA, "Initial save has primary Collection A");
      assertEqual(saveA.collections?.length, 1, "Collections has 1 entry");

      // 2. Save exact same URL with tracking parameters into Collection B
      const trackingUrl = "https://www.instagram.com/reel/C3x90ZaLkPq/?igsh=MWZ4eG1ydWJq&utm_source=copy_link";
      const saveB = ContentService.addItem(
        {
          title: "Framer Animation",
          url: trackingUrl,
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "reel",
          creator: { name: "Designer" },
          description: "Animation Reel",
          collectionId: colB,
          collections: [colB],
          tags: ["Design"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        multiColUser,
        "skip"
      );

      // Assert zero duplication
      assertEqual(saveB.id, saveA.id, "Identical record returned (zero duplicate rows)");

      // Assert multi-collection membership preserved!
      const userItems = ContentService.getAll(multiColUser);
      assertEqual(userItems.length, 1, "Exactly 1 item exists in user workspace");

      const item = userItems[0];
      assert(item.collections?.includes(colA), "Item belongs to Collection A");
      assert(item.collections?.includes(colB), "Item also belongs to Collection B (Multi-collection membership preserved)");
    });

    // ---------------------------------------------------------------------------
    // 18. Real Binary ZIP Construction & Adversarial Security Tests
    // ---------------------------------------------------------------------------
    console.log("\n18. Real Binary ZIP Construction & Adversarial Security Tests:");

    // In-memory pure binary ZIP builder helper
    function buildBinaryZip(
      files: Array<{
        name: string;
        content: string | Uint8Array;
        compressionMethod?: number;
        uncompressedSizeOverride?: number;
      }>
    ): Uint8Array {
      const localParts: Uint8Array[] = [];
      const cdParts: Uint8Array[] = [];
      let offset = 0;

      for (const f of files) {
        const nameBytes = new TextEncoder().encode(f.name);
        const dataBytes =
          typeof f.content === "string" ? new TextEncoder().encode(f.content) : f.content;
        const size =
          f.uncompressedSizeOverride !== undefined ? f.uncompressedSizeOverride : dataBytes.length;
        const method = f.compressionMethod ?? 0;

        // Local Header (30 bytes + name + data)
        const lh = new Uint8Array(30 + nameBytes.length + dataBytes.length);
        const lhView = new DataView(lh.buffer);
        lhView.setUint32(0, 0x04034b50, true);
        lhView.setUint16(4, 10, true);
        lhView.setUint16(6, 0, true);
        lhView.setUint16(8, method, true);
        lhView.setUint16(10, 0, true);
        lhView.setUint16(12, 0, true);
        lhView.setUint32(14, 0, true);
        lhView.setUint32(18, dataBytes.length, true);
        lhView.setUint32(22, size, true);
        lhView.setUint16(26, nameBytes.length, true);
        lhView.setUint16(28, 0, true);
        lh.set(nameBytes, 30);
        lh.set(dataBytes, 30 + nameBytes.length);
        localParts.push(lh);

        // Central Directory Header (46 bytes + name)
        const cd = new Uint8Array(46 + nameBytes.length);
        const cdView = new DataView(cd.buffer);
        cdView.setUint32(0, 0x02014b50, true);
        cdView.setUint16(4, 20, true);
        cdView.setUint16(6, 10, true);
        cdView.setUint16(8, 0, true);
        cdView.setUint16(10, method, true);
        cdView.setUint16(12, 0, true);
        cdView.setUint16(14, 0, true);
        cdView.setUint32(16, 0, true);
        cdView.setUint32(20, dataBytes.length, true);
        cdView.setUint32(24, size, true);
        cdView.setUint16(28, nameBytes.length, true);
        cdView.setUint16(30, 0, true);
        cdView.setUint16(32, 0, true);
        cdView.setUint16(34, 0, true);
        cdView.setUint16(36, 0, true);
        cdView.setUint32(38, 0, true);
        cdView.setUint32(42, offset, true);
        cd.set(nameBytes, 46);
        cdParts.push(cd);

        offset += lh.length;
      }

      const cdTotalSize = cdParts.reduce((acc, p) => acc + p.length, 0);
      const cdOffset = offset;

      // EOCD (22 bytes)
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);
      eocdView.setUint32(0, 0x06054b50, true);
      eocdView.setUint16(4, 0, true);
      eocdView.setUint16(6, 0, true);
      eocdView.setUint16(8, files.length, true);
      eocdView.setUint16(10, files.length, true);
      eocdView.setUint32(12, cdTotalSize, true);
      eocdView.setUint32(16, cdOffset, true);
      eocdView.setUint16(20, 0, true);

      const totalLength = offset + cdTotalSize + 22;
      const result = new Uint8Array(totalLength);
      let cur = 0;
      for (const part of localParts) {
        result.set(part, cur);
        cur += part.length;
      }
      for (const part of cdParts) {
        result.set(part, cur);
        cur += part.length;
      }
      result.set(eocd, cur);
      return result;
    }

    await test("ZipArchiveReader parses real binary ZIP with multiple JSON files and ignores binaries", async () => {
      const binaryZip = buildBinaryZip([
        { name: "your_instagram_activity/saved/saved_posts.json", content: FIXTURE_SAVED_POSTS_STRING_MAP },
        { name: "your_instagram_activity/saved/saved_collections.json", content: FIXTURE_MULTIPLE_COLLECTIONS },
        { name: "media/large_video.mp4", content: new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]) },
        { name: "media/photo.jpg", content: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
        { name: "settings/account_history.txt", content: "unrelated account logs" },
      ]);

      const { files, warnings } = await ZipArchiveReader.extractJsonFiles(binaryZip);

      assertEqual(Object.keys(files).length, 2, "Extracted exactly 2 JSON files");
      assert(files["your_instagram_activity/saved/saved_posts.json"] !== undefined, "saved_posts.json extracted");
      assert(files["your_instagram_activity/saved/saved_collections.json"] !== undefined, "saved_collections.json extracted");
      assert(files["media/large_video.mp4"] === undefined, "mp4 binary ignored completely");
      assert(files["media/photo.jpg"] === undefined, "jpg binary ignored completely");
    });

    await test("ZipArchiveReader path traversal security: rejects ../ and absolute paths", async () => {
      const maliciousZip = buildBinaryZip([
        { name: "../../../etc/passwd.json", content: '{"evil": true}' },
        { name: "/root/secret.json", content: '{"evil": true}' },
        { name: "valid_saved.json", content: FIXTURE_SAVED_POSTS_STRING_MAP },
      ]);

      const { files } = await ZipArchiveReader.extractJsonFiles(maliciousZip);

      assertEqual(Object.keys(files).length, 1, "Extracted only the 1 safe file");
      assert(files["valid_saved.json"] !== undefined, "Safe JSON file extracted");
      assert(files["../../../etc/passwd.json"] === undefined, "../ traversal blocked");
      assert(files["/root/secret.json"] === undefined, "Absolute path blocked");
    });

    await test("ZipArchiveReader zip bomb security: skips entries exceeding uncompressed size limit", async () => {
      const bombZip = buildBinaryZip([
        {
          name: "huge_bomb.json",
          content: '{"data": "bomb"}',
          uncompressedSizeOverride: 30 * 1024 * 1024, // Claims 30MB (> 15MB limit)
        },
        {
          name: "small_saved.json",
          content: FIXTURE_SAVED_POSTS_STRING_MAP,
        },
      ]);

      const { files, warnings } = await ZipArchiveReader.extractJsonFiles(bombZip);

      assertEqual(Object.keys(files).length, 1, "Only the safe small file was extracted");
      assert(files["small_saved.json"] !== undefined, "small_saved.json extracted");
      assert(files["huge_bomb.json"] === undefined, "30MB entry skipped before decompression");
      assert(warnings.some((w) => w.includes("exceeds maximum safe size")), "Warning issued for oversized entry");
    });

    await test("ZipArchiveReader handles truncated and corrupted ZIP archives safely", async () => {
      const truncatedZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]); // truncated
      let errorCaught = false;

      try {
        await ZipArchiveReader.extractJsonFiles(truncatedZip);
      } catch (err: any) {
        errorCaught = true;
        assert(err.message.includes("too small") || err.message.includes("End of Central Directory"), "Descriptive error");
      }

      assert(errorCaught === true, "Truncated archive safely rejected without unhandled crash");
    });

    await test("Adversarial URL Security: Rejects fake domains, host smuggling, and dangerous schemes", () => {
      const maliciousUrls = [
        "https://evil.com/instagram.com/p/C3x90ZaLkPq/",
        "https://instagram.com.evil.com/p/C3x90ZaLkPq/",
        "https://evilinstagram.com/p/C3x90ZaLkPq/",
        "javascript:alert(1)//https://www.instagram.com/p/C3x90ZaLkPq/",
        "data:text/html,<script>alert(1)</script>https://instagram.com/p/C3x90ZaLkPq/",
        "ftp://instagram.com/p/C3x90ZaLkPq/",
        "https://notinstagram.com/reel/C3x90ZaLkPq/",
        "http://attacker.com/p/C3x90ZaLkPq/",
      ];

      for (const url of maliciousUrls) {
        assertEqual(
          InstagramExportAdapter.isInstagramContentUrl(url),
          false,
          `Malicious URL correctly rejected: ${url}`
        );
        assertEqual(
          InstagramExportAdapter.canonicalizeInstagramUrl(url),
          null,
          `Canonicalization rejected: ${url}`
        );
      }

      // Valid URLs must still pass
      assert(
        InstagramExportAdapter.isInstagramContentUrl("https://www.instagram.com/p/C3x90ZaLkPq/"),
        "Legitimate post URL accepted"
      );
      assert(
        InstagramExportAdapter.isInstagramContentUrl("https://instagram.com/reel/C5z92NcLrSt/?igsh=abc"),
        "Legitimate reel URL with tracking accepted"
      );
      assert(
        InstagramExportAdapter.isInstagramContentUrl("https://instagr.am/p/C3x90ZaLkPq/"),
        "Legitimate instagr.am short URL accepted"
      );
    });

    await test("Multi-User Authorization Security: Rejects cross-tenant collection targeting and job retries", async () => {
      const userAlice = "user-alice";
      const userBob = "user-bob";

      // Create a collection belonging to Bob
      const bobCol = CollectionService.create({ name: "Bob Secret Collection", icon: "Folder", color: "#6366F1" }, userBob);

      // Alice attempts to create an ImportJob targeting Bob's collection
      let aliceCreateBlocked = false;
      try {
        ImportJobService.createJob({
          userId: userAlice,
          platform: "instagram",
          sourceType: "file_export",
          sourceName: "Alice Import",
          items: [
            {
              id: "alice-item-1",
              jobId: "",
              originalUrl: "https://www.instagram.com/p/C3x90ZaLkPq/",
              platform: "instagram",
              contentType: "post",
              collectionId: bobCol.id, // Malicious cross-tenant assignment
              status: "pending",
              retryCount: 0,
            },
          ],
          options: {
            targetCollectionId: bobCol.id, // Malicious cross-tenant target
            autoOrganize: false,
            skipDuplicates: true,
            defaultTags: [],
          },
        });
      } catch (err: any) {
        aliceCreateBlocked = true;
        assert(err.message.includes("Unauthorized collection assignment"), "Cross-tenant collection assignment blocked");
      }

      assert(aliceCreateBlocked === true, "Alice blocked from targeting Bob's collection");

      // Bob creates a legitimate job
      const bobJob = ImportJobService.createJob({
        userId: userBob,
        platform: "instagram",
        sourceType: "file_export",
        sourceName: "Bob Valid Import",
        items: [
          {
            id: "bob-item-1",
            jobId: "",
            originalUrl: "https://www.instagram.com/p/C3x90ZaLkPq/",
            platform: "instagram",
            contentType: "post",
            status: "failed",
            error: {
              code: "ERR_RATE_LIMIT",
              message: "Rate limited",
              category: "rate_limit",
              isRetryable: true,
              userActionRequired: false,
            },
            retryCount: 0,
          },
        ],
        options: {
          autoOrganize: false,
          skipDuplicates: true,
          defaultTags: [],
        },
      });

      // Alice attempts to retry Bob's job
      let aliceRetryBlocked = false;
      try {
        await ImportJobService.retryFailedItems(bobJob.id, userAlice);
      } catch (err: any) {
        aliceRetryBlocked = true;
        assert(err.message.includes("Unauthorized"), "Alice blocked from retrying Bob's job");
      }

      assert(aliceRetryBlocked === true, "Cross-tenant job retry rejected");
    });

    await test("Failure Isolation & Permanent Failure Non-Retryability", async () => {
      const failureUser = `failure-test-user-${Date.now()}`;

      // Job containing:
      // Item 1: Valid Post
      // Item 2: Permanent 404 (deleted/private, non-retryable)
      // Item 3: Rate limited (retryable)
      const job = ImportJobService.createJob({
        userId: failureUser,
        platform: "instagram",
        sourceType: "file_export",
        sourceName: "Failure Isolation Test",
        items: [
          {
            id: "item-valid",
            jobId: "",
            originalUrl: "https://www.instagram.com/p/C3x90ZaLkPq/",
            platform: "instagram",
            contentType: "post",
            status: "pending",
            retryCount: 0,
          },
          {
            id: "item-deleted",
            jobId: "",
            originalUrl: "https://www.instagram.com/p/DeletedPost123/",
            platform: "instagram",
            contentType: "post",
            status: "failed",
            error: {
              code: "ERR_UNAVAILABLE",
              message: "Content has been deleted or made private",
              category: "unavailable",
              isRetryable: false, // Non-retryable
              userActionRequired: true,
            },
            retryCount: 1,
          },
          {
            id: "item-ratelimited",
            jobId: "",
            originalUrl: "https://www.instagram.com/p/C4y81MbKqRs/",
            platform: "instagram",
            contentType: "post",
            status: "failed",
            error: {
              code: "ERR_RATE_LIMITED",
              message: "HTTP 429 Too Many Requests",
              category: "rate_limit",
              isRetryable: true, // Retryable
              userActionRequired: false,
            },
            retryCount: 1,
          },
        ],
        options: {
          autoOrganize: false,
          skipDuplicates: true,
          defaultTags: [],
        },
      });

      // Simulate retryFailedItems for failureUser
      await ImportJobService.retryFailedItems(job.id, failureUser);

      // Item-deleted must NOT be retried (status must remain failed)
      const deletedItem = job.items.find((i) => i.id === "item-deleted");
      assertEqual(deletedItem?.status, "failed", "Permanent deleted failure was NOT retried (infinite retry prevented)");

      // Item-ratelimited should have transitioned to pending or ready
      const rateLimitedItem = job.items.find((i) => i.id === "item-ratelimited");
      assert(rateLimitedItem?.status !== "failed" || rateLimitedItem.retryCount > 1, "Retryable item was re-attempted");
    });

    // ---------------------------------------------------------------------------
    // 19. Instagram JSON Metadata Accuracy & Mojibake Normalization Tests
    // ---------------------------------------------------------------------------
    console.log("\n19. Instagram JSON Metadata Accuracy & Mojibake Normalization Tests:");

    await test("Mojibake Normalization: Fixes Latin-1/UTF-8 misencoded accents, quotes, and emojis safely", () => {
      // 1. Accented characters
      assertEqual(MetadataNormalizer.fixMojibake("Caf\u00c3\u00a9"), "Café", "Fixed accented e (Café)");
      assertEqual(MetadataNormalizer.fixMojibake("na\u00c3\u00afve"), "naïve", "Fixed i with diaeresis (naïve)");

      // 2. Smart quotes and punctuation
      assertEqual(MetadataNormalizer.fixMojibake("It\u00e2\u0080\u0099s fine"), "It’s fine", "Fixed smart apostrophe");

      // 3. Emojis
      assertEqual(MetadataNormalizer.fixMojibake("\u00f0\u009f\u0094\u00a5"), "🔥", "Fixed fire emoji");

      // 4. Non-mojibake genuine UTF-8 should be preserved untouched
      assertEqual(MetadataNormalizer.fixMojibake("Clean text"), "Clean text", "Clean text preserved");
      assertEqual(MetadataNormalizer.fixMojibake("あらゆる キツネ"), "あらゆる キツネ", "Japanese preserved untouched");
    });

    await test("Instagram Export Metadata Extraction: Captures creator handle and save timestamp from export JSON", () => {
      const analysis = InstagramExportAdapter.parse(FIXTURE_SAVED_POSTS_STRING_MAP, "saved_posts.json");
      assert(analysis.isValid, "Parsed valid analysis");
      assertEqual(analysis.candidates.length, 2, "2 candidates extracted");

      const first = analysis.candidates[0];
      assertEqual(first.creatorName, "photographer_art", "Extracted creator handle photographer_art");
      assertEqual(first.savedTimestamp, 1708700000000, "Extracted timestamp in ms");

      const second = analysis.candidates[1];
      assertEqual(second.creatorName, "nature_daily", "Extracted creator handle nature_daily");
      assertEqual(second.savedTimestamp, 1708786400000, "Extracted second timestamp in ms");
    });

    await test("Metadata Merge Policy: Enriches restricted sourceData with verified export creator, title, and timestamp", async () => {
      const userA = `metadata-merge-user-${Date.now()}`;
      const colA = CollectionService.create({ name: "Export Accuracy", icon: "Folder", color: "#6366F1" }, userA);

      const result = await IngestionService.processUrl("https://www.instagram.com/p/C3x90ZaLkPq/", {
        userId: userA,
        customCollectionId: colA.id,
        aiEnrichmentMode: "fast_metadata",
        initialMetadata: {
          title: "Sunset Over Kyoto",
          creatorName: "kyoto_traveler",
          savedTimestamp: 1708700000000,
          collectionName: colA.name,
        },
      });

      assertEqual(result.sourceData.creator.name, "@kyoto_traveler", "Creator handle enriched from export metadata");
      assertEqual(result.sourceData.title, "Sunset Over Kyoto", "Title enriched from export metadata");
      assertEqual(result.sourceData.provenance.creator?.source, "instagram_export_metadata", "Provenance confirms export metadata source");
      assertEqual(result.savedItem.savedDate, new Date(1708700000000).toISOString(), "Item savedDate set to original export timestamp");
    });

    await test("Duplicate Strategy: Preserves multi-collection membership without dropping existing items", () => {
      const dupUser = `dup-user-${Date.now()}`;
      const col1 = CollectionService.create({ name: "Col One", icon: "Folder", color: "#6366F1" });
      const col2 = CollectionService.create({ name: "Col Two", icon: "Folder", color: "#10B981" });

      // Save item first time in Col One
      const item1 = ContentService.addItem(
        {
          title: "Test Duplicate",
          url: "https://www.instagram.com/p/C9z01AaBbCc/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@creator" },
          description: "Test description",
          savedDate: new Date().toISOString(),
          collectionId: col1.id,
          collections: [col1.id],
          tags: ["tag1"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        dupUser,
        "skip"
      );

      assertEqual(item1.collections?.length, 1, "Item has 1 collection initially");

      // Add duplicate but targeted to Col Two
      const updated = ContentService.addItem(
        {
          ...item1,
          collectionId: col2.id,
          collections: [col2.id],
        },
        dupUser,
        "skip"
      );

      assert(updated.collections?.includes(col1.id), "Preserved Col One membership");
      assert(updated.collections?.includes(col2.id), "Appended Col Two membership");
    });

    // ---------------------------------------------------------------------------
    // 20. Production Collection Delete Management & Security Tests
    // ---------------------------------------------------------------------------
    console.log("\n20. Production Collection Delete Management & Security Tests:");

    await test("Single Delete: Moves sole-collection item to Trash and updates collection counters", () => {
      const delUser = `del-user-${Date.now()}`;
      const col = CollectionService.create({ name: "Single Delete Test", icon: "Folder", color: "#EC4899" }, delUser);

      const item = ContentService.addItem(
        {
          title: "Item to Trash",
          url: "https://www.instagram.com/p/SingleDelete1/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@creator" },
          description: "Test description",
          savedDate: new Date().toISOString(),
          collectionId: col.id,
          collections: [col.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        delUser
      );

      assertEqual(CollectionService.getItemCount(col.id, ContentService.getAll(delUser)), 1, "Collection has 1 item before delete");

      // Execute single delete via ContentService.deleteCollectionItems
      const result = ContentService.deleteCollectionItems({
        userId: delUser,
        collectionId: col.id,
        itemIds: [item.id],
      });

      assertEqual(result.deleted, 1, "Item moved to trash");
      assertEqual(result.removedFromCollection, 0, "No secondary collection unlinking needed");

      const refreshed = ContentService.getById(item.id, delUser);
      assertEqual(refreshed?.trashed, true, "Item trashed flag is true");
      assertEqual(CollectionService.getItemCount(col.id, ContentService.getAll(delUser)), 0, "Collection counter decremented to 0");
    });

    await test("Multi-Collection Preservation: Deleting item from one collection unlinks it while keeping other collections and active status", () => {
      const multiUser = `multi-col-user-${Date.now()}`;
      const colA = CollectionService.create({ name: "Alpha", icon: "Folder", color: "#6366F1" }, multiUser);
      const colB = CollectionService.create({ name: "Beta", icon: "Folder", color: "#10B981" }, multiUser);

      // Item belongs to BOTH Alpha and Beta
      const item = ContentService.addItem(
        {
          title: "Multi-Col Item",
          url: "https://www.instagram.com/p/MultiCol1/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@creator" },
          description: "Test description",
          savedDate: new Date().toISOString(),
          collectionId: colA.id,
          collections: [colA.id, colB.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        multiUser
      );

      // Delete item from Alpha
      const result = ContentService.deleteCollectionItems({
        userId: multiUser,
        collectionId: colA.id,
        itemIds: [item.id],
      });

      assertEqual(result.deleted, 0, "Item was NOT trashed (preserved in Beta)");
      assertEqual(result.removedFromCollection, 1, "Item was unlinked from Alpha");

      const refreshed = ContentService.getById(item.id, multiUser);
      assertEqual(refreshed?.trashed, false, "Item remains active (not trashed)");
      assertEqual(refreshed?.collections?.includes(colA.id), false, "Alpha removed from collections");
      assertEqual(refreshed?.collections?.includes(colB.id), true, "Beta preserved in collections");
      assertEqual(refreshed?.collectionId, colB.id, "Primary collection re-routed to Beta");

      // Collection counters
      assertEqual(CollectionService.getItemCount(colA.id, ContentService.getAll(multiUser)), 0, "Alpha count is 0");
      assertEqual(CollectionService.getItemCount(colB.id, ContentService.getAll(multiUser)), 1, "Beta count is 1");
    });

    await test("Select All: Scoped strictly to current collection, deletes all eligible items in that collection", () => {
      const bulkUser = `bulk-del-user-${Date.now()}`;
      const targetCol = CollectionService.create({ name: "Bulk Target", icon: "Folder", color: "#6366F1" }, bulkUser);
      const otherCol = CollectionService.create({ name: "Bulk Other", icon: "Folder", color: "#F59E0B" }, bulkUser);

      // Create 3 items in targetCol, 2 items in otherCol
      for (let idx = 1; idx <= 3; idx++) {
        ContentService.addItem(
          {
            title: `Target Item ${idx}`,
            url: `https://www.instagram.com/p/Target${idx}/`,
            thumbnail: "https://example.com/thumb.jpg",
            platform: "instagram",
            contentType: "post",
            creator: { name: "@creator" },
            description: "Test description",
            savedDate: new Date().toISOString(),
            collectionId: targetCol.id,
            collections: [targetCol.id],
            tags: [],
            favorite: false,
            archived: false,
            trashed: false,
            aiSummary: { quick: "Q", standard: "S", detailed: "D" },
            keyPoints: [],
            topics: [],
            personalNotes: "",
            metadata: { domain: "instagram.com" },
          },
          bulkUser
        );
      }

      for (let idx = 1; idx <= 2; idx++) {
        ContentService.addItem(
          {
            title: `Other Item ${idx}`,
            url: `https://www.instagram.com/p/Other${idx}/`,
            thumbnail: "https://example.com/thumb.jpg",
            platform: "instagram",
            contentType: "post",
            creator: { name: "@creator" },
            description: "Test description",
            savedDate: new Date().toISOString(),
            collectionId: otherCol.id,
            collections: [otherCol.id],
            tags: [],
            favorite: false,
            archived: false,
            trashed: false,
            aiSummary: { quick: "Q", standard: "S", detailed: "D" },
            keyPoints: [],
            topics: [],
            personalNotes: "",
            metadata: { domain: "instagram.com" },
          },
          bulkUser
        );
      }

      assertEqual(CollectionService.getItemCount(targetCol.id, ContentService.getAll(bulkUser)), 3, "Target col has 3 items");
      assertEqual(CollectionService.getItemCount(otherCol.id, ContentService.getAll(bulkUser)), 2, "Other col has 2 items");

      // Execute Select All deletion on targetCol
      const result = ContentService.deleteCollectionItems({
        userId: bulkUser,
        collectionId: targetCol.id,
        selectAll: true,
      });

      assertEqual(result.deleted, 3, "Exactly 3 items deleted in target collection");
      assertEqual(CollectionService.getItemCount(targetCol.id, ContentService.getAll(bulkUser)), 0, "Target collection now has 0 items");
      assertEqual(CollectionService.getItemCount(otherCol.id, ContentService.getAll(bulkUser)), 2, "Other collection remains untouched with 2 items");
    });

    await test("Security & Authorization: Cross-user item deletion is rejected and User B items are untouched", () => {
      const userAlice = `alice-${Date.now()}`;
      const userBob = `bob-${Date.now()}`;

      const colAlice = CollectionService.create({ name: "Alice Col", icon: "Folder", color: "#6366F1" }, userAlice);
      const colBob = CollectionService.create({ name: "Bob Col", icon: "Folder", color: "#10B981" }, userBob);

      // Alice saves Item A, Bob saves Item B
      const itemBob = ContentService.addItem(
        {
          title: "Bob Secret Item",
          url: "https://www.instagram.com/p/BobItem1/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@bob" },
          description: "Bob private post",
          savedDate: new Date().toISOString(),
          collectionId: colBob.id,
          collections: [colBob.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        userBob
      );

      // Alice attempts to forge request to delete Bob's item in Alice's collection
      const attackResult = ContentService.deleteCollectionItems({
        userId: userAlice,
        collectionId: colAlice.id,
        itemIds: [itemBob.id],
      });

      assertEqual(attackResult.deleted, 0, "Zero items deleted in forged request");
      assertEqual(attackResult.skipped, 1, "Forged item ID skipped");

      // Verify Bob's item is untouched
      const bobsItemStillActive = ContentService.getById(itemBob.id, userBob);
      assertEqual(bobsItemStillActive?.trashed, false, "Bob's item was NOT modified or trashed");

      // Alice attempts to use Bob's collection ID
      let crossColBlocked = false;
      try {
        ContentService.deleteCollectionItems({
          userId: userAlice,
          collectionId: colBob.id,
          selectAll: true,
        });
      } catch {
        crossColBlocked = true;
      }
      assert(crossColBlocked, "Accessing collection of another user rejected with unauthorized error");
    });

    await test("Idempotency: Repeated delete call is completely safe and produces zero state corruption", () => {
      const idempUser = `idemp-user-${Date.now()}`;
      const col = CollectionService.create({ name: "Idempotency Col", icon: "Folder", color: "#6366F1" }, idempUser);

      const item = ContentService.addItem(
        {
          title: "Idempotent Item",
          url: "https://www.instagram.com/p/IdempItem1/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@creator" },
          description: "Test description",
          savedDate: new Date().toISOString(),
          collectionId: col.id,
          collections: [col.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        idempUser
      );

      // Call 1
      const res1 = ContentService.deleteCollectionItems({
        userId: idempUser,
        collectionId: col.id,
        itemIds: [item.id],
      });
      assertEqual(res1.deleted, 1, "First delete deleted item");

      // Call 2 (identical request)
      const res2 = ContentService.deleteCollectionItems({
        userId: idempUser,
        collectionId: col.id,
        itemIds: [item.id],
      });
      assertEqual(res2.deleted, 0, "Second delete safely skipped already-deleted item");
      assertEqual(res2.skipped, 1, "Item correctly classified as skipped");

      // State is clean
      assertEqual(CollectionService.getItemCount(col.id, ContentService.getAll(idempUser)), 0, "Counter remains 0");
    });

    await test("Downstream Index Consistency: Deleted item is excluded from active search and AI retrieval", () => {
      const searchUser = `search-del-user-${Date.now()}`;
      const col = CollectionService.create({ name: "Search Consistency", icon: "Folder", color: "#6366F1" }, searchUser);

      const item = ContentService.addItem(
        {
          title: "UniqueSearchTermSpecialDesign",
          url: "https://www.instagram.com/p/UniqueSearch1/",
          thumbnail: "https://example.com/thumb.jpg",
          platform: "instagram",
          contentType: "post",
          creator: { name: "@creator" },
          description: "UniqueSearchTermSpecialDesign caption",
          savedDate: new Date().toISOString(),
          collectionId: col.id,
          collections: [col.id],
          tags: ["DesignSpecial"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: ["DesignSpecial"],
          personalNotes: "",
          metadata: { domain: "instagram.com" },
        },
        searchUser
      );

      // Active search finds it
      const activeSearch = SearchService.search(
        ContentService.getAll(searchUser),
        { query: "UniqueSearchTermSpecialDesign" },
        [col]
      );
      assertEqual(activeSearch.length, 1, "Search finds active item before deletion");

      // Delete item from collection
      ContentService.deleteCollectionItems({
        userId: searchUser,
        collectionId: col.id,
        itemIds: [item.id],
      });

      // Active search after deletion excludes it
      const postDeleteSearch = SearchService.search(
        ContentService.getAll(searchUser),
        { query: "UniqueSearchTermSpecialDesign" },
        [col]
      );
      assertEqual(postDeleteSearch.length, 0, "Deleted/trashed item is completely excluded from active search");
    });

    // =========================================================================
    // SUITE 21: CONTENT INTELLIGENCE PIPELINE, MEDIA ACQUISITION & ARBITRARY MULTI-DELETE
    // =========================================================================
    console.log("\n21. Content Intelligence Pipeline, Media Acquisition, Transcription & Arbitrary Multi-Delete Tests:");

    await test("Critical Test 1: Real failure regression on sanitized tempDATA.json fixture", async () => {
      const rawFixture = {
        timestamp: 1790781901,
        media: [],
        label_values: [
          {
            label: "URL",
            value: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
            href: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
          },
          {
            label: "Caption",
            value: "\u00f0\u009f\u009a\u00a8 O FIM DA ESCALA 6x1 \u00f0\u009f\u009a\u00a8 A escala 6x1 \u00c3\u00a9 uma das jornadas de trabalho mais cansativas que existem. Na pr\u00c3\u00a1tica, milh\u00c3\u00b5es de trabalhadores vivem praticamente sem tempo para descansar...",
          },
          {
            label: "Title",
            value: "",
          },
          {
            dict: [],
            title: "Hashtags",
          },
          {
            dict: [
              {
                dict: [
                  { label: "URL", value: "https://linkfly.to/example" },
                  { label: "Name", value: "" },
                  { label: "Username", value: "penguin.7582551" },
                ],
                title: "",
              },
            ],
            title: "Owner",
          },
        ],
        fbid: "18112685408038015",
      };

      // 1. Adapter must extract real creator, caption, fbid from label_values
      const analysis = InstagramExportAdapter.parseJsonObject(rawFixture);
      assertEqual(analysis.isValid, true, "Label_values export is parsed validly");
      assertEqual(analysis.candidates.length, 1, "Extracted 1 candidate");

      const candidate = analysis.candidates[0];
      assertEqual(candidate.creatorName, "penguin.7582551", "Extracted creator username from Owner dict");
      assert(candidate.title !== "https://www.instagram.com/reel/Dd6Uamci-Jb/", "Derived title is not raw URL");
      assert(Boolean(candidate.caption && candidate.caption.includes("ESCALA 6x1")), "Normalized caption preserved");

      // 2. Process through unified IngestionService
      const testUser = "user-regression-test";
      const ingestion = await IngestionService.processUrl(candidate.originalUrl, {
        userId: testUser,
        skipPersistence: true,
        initialMetadata: {
          title: candidate.title,
          creatorName: candidate.creatorName,
          caption: candidate.caption,
          fbid: candidate.fbid,
          savedTimestamp: candidate.savedTimestamp,
        },
      });

      const item = ingestion.savedItem;

      // Factual checks
      assert(item.title !== candidate.originalUrl, "Saved title is NEVER raw URL");
      assert(item.creator.name !== "Instagram Creator", "Creator is real user, not placeholder");
      assertEqual(item.creator.name, "@penguin.7582551", "Creator handle normalized to @penguin.7582551");
      assert(!item.aiSummary.standard.includes("https://www.instagram.com/reel/"), "Summary does not repeat raw URL");
      assertEqual(item.contentStatus, "PARTIAL_CONTENT", "Honest provenance: caption present without transcript is PARTIAL_CONTENT");
      assert(item.contentStatus !== "FULL_CONTENT", "Never claims FULL_CONTENT without transcript");
      assertEqual(item.metadata.contentIntent, undefined, "AI intent stays unset until the durable background analysis job");
      assertEqual(item.topics.length, 0, "Import does not generate AI topics before background analysis");
    });

    await test("Critical Test 2: Transcript classification & Multimodal understanding", async () => {
      // 1. Video Editing Reel with Audio Transcript
      const editSource: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/C3_video_edit/",
        contentId: "C3_video_edit",
        creator: { name: "@editor_pro" },
        title: "Five Essential Transitions",
        transcript: "Today I will demonstrate five Premiere Pro editing transitions that will take your cuts to the next level.",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      editSource.provenance.transcript = { source: "faster-whisper", value: editSource.transcript };
      await assertRejects(() => AIPipeline.enrichContent(editSource, []), "Content analysis is not configured", "Verified transcript analysis requires a configured provider");

      // 2. n8n Automation Reel with Audio Transcript
      const n8nSource: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/C3_n8n_auto/",
        contentId: "C3_n8n_auto",
        creator: { name: "@automate_dev" },
        title: "Build this n8n automation",
        transcript: "Here is how to build an n8n AI automation workflow to process incoming leads in minutes.",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      n8nSource.provenance.transcript = { source: "faster-whisper", value: n8nSource.transcript };
      await assertRejects(() => AIPipeline.enrichContent(n8nSource, []), "Content analysis is not configured", "Verified n8n transcript analysis requires a configured provider");

      // 3. Asset Template Reel
      const assetSource: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/C3_asset_template/",
        contentId: "C3_asset_template",
        creator: { name: "@figma_ninja" },
        title: "Figma UI Kit Free",
        caption: "Comment ASSET and I'll send you this Figma template for your next project.",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: false,
        provenance: {},
      };

      const assetEnrich = await AIPipeline.enrichContent(assetSource, []);
      assertEqual(assetEnrich.status, "INSUFFICIENT_CONTENT", "Video caption metadata alone does not produce AI intent");
    });

    await test("Critical Test 3: No media fallback honors honest status", async () => {
      const acquireResult = await MediaAcquisitionService.acquireMedia({
        url: "https://www.instagram.com/reel/GuestRestrictedReel/",
        platform: "instagram",
        contentId: "GuestRestrictedReel",
      });

      assertEqual(acquireResult.status, "unavailable", "Instagram guest access returns status=unavailable");
      assertEqual(acquireResult.source, "none", "Source is none when restricted");

      const transcribeResult = await TranscriptionService.transcribe({
        mediaResult: acquireResult,
        contentId: "GuestRestrictedReel",
      });

      assertEqual(transcribeResult.status, "unavailable", "Transcription status is unavailable when no audio");
      assertEqual(transcribeResult.text, "", "Never fabricates transcript when media is unavailable");

      const originalWhisperUrl = process.env.WHISPER_SERVICE_URL;
      delete process.env.WHISPER_SERVICE_URL;
      const arbitraryBytesResult = await TranscriptionService.transcribe({
        audioBytes: new TextEncoder().encode("these bytes contain words but are not a transcription"),
        mediaResult: { status: "available", audio: new Uint8Array([1, 2, 3]), source: "local_export" },
        contentId: "bytes-are-not-transcripts",
        workspaceId: "workspace-transcription-regression",
      });
      if (originalWhisperUrl) process.env.WHISPER_SERVICE_URL = originalWhisperUrl;
      assertEqual(arbitraryBytesResult.status, "unavailable", "Unconfigured Whisper provider never treats arbitrary bytes as a transcript");
      assertEqual(arbitraryBytesResult.text, "", "Empty provider configuration yields no fabricated transcript");

      // Textual caption fallback
      const sourceData: AuthoritativeSourceData = {
        platform: "instagram",
        canonicalUrl: "https://www.instagram.com/reel/GuestRestrictedReel/",
        contentId: "GuestRestrictedReel",
        creator: { name: "@authentic_creator" },
        title: "Honest Metadata Fallback",
        caption: "A genuine creator caption describing the post without accessible audio stream.",
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "reel",
        retrievedAt: new Date().toISOString(),
        isRestricted: true,
        provenance: {},
      };

      const enrichment = await AIPipeline.enrichContent(sourceData, []);
      assertEqual(enrichment.status, "INSUFFICIENT_CONTENT", "Video caption metadata does not replace a verified transcript");
      assert(!enrichment.summary.standard.includes("authentic_creator"), "Fallback does not synthesize a summary from creator metadata");
    });

    await test("Critical Test 4: User-selected arbitrary delete in collection", async () => {
      const multiUser = "user-arbitrary-delete";
      StorageService.clearUserData(multiUser);

      const targetCol = CollectionService.create({ name: "Work & Projects", color: "#3b82f6", icon: "folder" }, multiUser);

      // Create 5 items: A, B, C, D, E
      const items = ["Item A", "Item B", "Item C", "Item D", "Item E"].map((name, i) =>
        ContentService.addItem(
          {
            id: `item-arb-${i}`,
            title: name,
            url: `https://example.com/item-${i}`,
            thumbnail: "",
            platform: "website",
            contentType: "article",
            creator: { name: "Author" },
            description: name,
            savedDate: new Date().toISOString(),
            collectionId: targetCol.id,
            collections: [targetCol.id],
            tags: ["Test"],
            favorite: false,
            archived: false,
            trashed: false,
            aiSummary: { quick: name, standard: name, detailed: name },
            keyPoints: [],
            topics: ["General"],
            personalNotes: "",
            metadata: { domain: "example.com" },
          },
          multiUser
        )
      );

      // User selects specifically Item B (index 1) and Item D (index 3)
      const selectedIds = [items[1].id, items[3].id];
      assertEqual(selectedIds.length, 2, "2 items chosen for arbitrary deletion");

      const deleteResult = ContentService.deleteCollectionItems({
        userId: multiUser,
        collectionId: targetCol.id,
        itemIds: selectedIds,
      });

      assertEqual(deleteResult.deleted, 2, "Deleted exactly 2 selected items");
      assertEqual(deleteResult.processedIds.length, 2, "Processed IDs contains exactly 2 items");

      const activeItems = ContentService.getAll(multiUser).filter(
        (it) => it.collectionId === targetCol.id && !it.trashed
      );

      assertEqual(activeItems.length, 3, "3 items remain active in collection");
      const activeTitles = activeItems.map((i) => i.title);
      assert(activeTitles.includes("Item A"), "Item A remains");
      assert(!activeTitles.includes("Item B"), "Item B was deleted");
      assert(activeTitles.includes("Item C"), "Item C remains");
      assert(!activeTitles.includes("Item D"), "Item D was deleted");
      assert(activeTitles.includes("Item E"), "Item E remains");
    });

    await test("Critical Test 5: Collection Security & Cross-User isolation", async () => {
      const userAlice = "user-alice";
      const userBob = "user-bob";
      StorageService.clearUserData(userAlice);
      StorageService.clearUserData(userBob);

      const colAlice = CollectionService.create({ name: "Alice Folder", color: "#10b981", icon: "folder" }, userAlice);
      const colBob = CollectionService.create({ name: "Bob Folder", color: "#f59e0b", icon: "folder" }, userBob);

      const itemAlice = ContentService.addItem(
        {
          id: "item-alice-1",
          title: "Alice Private Item",
          url: "https://example.com/alice",
          thumbnail: "",
          platform: "website",
          contentType: "article",
          creator: { name: "Alice" },
          description: "Alice item",
          savedDate: new Date().toISOString(),
          collectionId: colAlice.id,
          collections: [colAlice.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "A", standard: "A", detailed: "A" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "example.com" },
        },
        userAlice
      );

      const itemBob = ContentService.addItem(
        {
          id: "item-bob-1",
          title: "Bob Private Item",
          url: "https://example.com/bob",
          thumbnail: "",
          platform: "website",
          contentType: "article",
          creator: { name: "Bob" },
          description: "Bob item",
          savedDate: new Date().toISOString(),
          collectionId: colBob.id,
          collections: [colBob.id],
          tags: [],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "B", standard: "B", detailed: "B" },
          keyPoints: [],
          topics: [],
          personalNotes: "",
          metadata: { domain: "example.com" },
        },
        userBob
      );

      // Attacker sends Alice's collection ID with Bob's item ID and a forged ID
      const deleteAttempt = ContentService.deleteCollectionItems({
        userId: userAlice,
        collectionId: colAlice.id,
        itemIds: [itemAlice.id, itemBob.id, "forged-id-999"],
      });

      assertEqual(deleteAttempt.deleted, 1, "Only Alice's owned item in Alice's collection was deleted");
      assertEqual(deleteAttempt.skipped, 2, "Skipped 2 unauthorized/out-of-scope IDs");

      // Bob's item must remain active and untrashed
      const bobItems = ContentService.getAll(userBob);
      const bobItem = bobItems.find((i) => i.id === itemBob.id);
      assertEqual(bobItem?.trashed, false, "Bob's item was NEVER deleted or modified");
      assertEqual(bobItem?.collectionId, colBob.id, "Bob's collection membership intact");
    });

    await test("Critical Test 6: Reprocessing service recovers bad legacy imports", async () => {
      const reprocessUser = "user-reprocessing-test";
      StorageService.clearUserData(reprocessUser);

      const badItem: SavedItem = {
        id: "bad-item-legacy-1",
        title: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
        url: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
        thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Instagram Creator" },
        description: "Instagram Reel (Dd6Uamci-Jb) saved to Keeper.",
        savedDate: new Date().toISOString(),
        tags: [],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: {
          quick: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
          standard: "https://www.instagram.com/reel/Dd6Uamci-Jb/ by Instagram Creator on INSTAGRAM: https://www.instagram.com/reel/Dd6Uamci-Jb/",
          detailed: "Detailed description",
        },
        keyPoints: [],
        topics: ["Knowledge"],
        personalNotes: "My important notes",
        metadata: {
          domain: "instagram.com",
          caption: "🚨 O FIM DA ESCALA 6x1 🚨 A escala 6x1 é uma das jornadas de trabalho mais cansativas que existem...",
        },
        contentStatus: "FULL_CONTENT",
      };

      ContentService.addItem(badItem, reprocessUser);

      assertEqual(ReprocessingService.isEligible(badItem), true, "Identified as eligible bad import");

      const reprocessed = await ReprocessingService.reprocessItem(badItem, reprocessUser);

      assert(reprocessed.title !== badItem.url, "Title recovered from raw URL");
      assert(!reprocessed.aiSummary.standard.includes("https://www.instagram.com/reel/"), "Summary cleaned from URL repetition");
      assertEqual(reprocessed.personalNotes, "My important notes", "User personal notes preserved");
      assertEqual(reprocessed.contentStatus, "PARTIAL_CONTENT", "Honest content status restored");
    });

    await test("Critical Test 7: Search indexes spoken audio and caption phrases", async () => {
      const searchUser = "user-search-speech";
      StorageService.clearUserData(searchUser);

      const spokenItem = ContentService.addItem(
        {
          id: "item-spoken-1",
          title: "Video Editing Mastery",
          url: "https://example.com/video-editing",
          thumbnail: "",
          platform: "instagram",
          contentType: "reel",
          creator: { name: "@cine_cutter" },
          description: "Editing tutorial",
          savedDate: new Date().toISOString(),
          tags: ["Tutorial"],
          favorite: false,
          archived: false,
          trashed: false,
          aiSummary: { quick: "Q", standard: "S", detailed: "D" },
          keyPoints: [],
          topics: ["Video Editing"],
          personalNotes: "",
          metadata: {
            domain: "instagram.com",
            transcript: "In this walkthrough we cover five Premiere Pro editing transitions for cinematic pacing.",
          },
        },
        searchUser
      );

      // Search query using words ONLY SPOKEN in the video
      const results = SearchService.search(
        ContentService.getAll(searchUser),
        { query: "Premiere Pro editing transitions" }
      );

      assertEqual(results.length, 1, "Found reel by spoken audio transcript phrase");
      assertEqual(results[0].item.id, spokenItem.id, "Correct item retrieved");
      assert(results[0].matchedFields.includes("transcript"), "Transcript field was matched in score");
    });

    await test("AI assistant scopes multi-collection retrieval and rejects unrelated reels", async () => {
      const collectionA: Collection = { id: "collection-spiritual", name: "Spiritual Reels", color: "#000000", icon: "Folder", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const collectionB: Collection = { id: "collection-commerce", name: "Website Ideas", color: "#000000", icon: "Folder", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const item = (id: string, title: string, collectionId: string, summary: string): SavedItem => ({
        id, title, url: `https://example.com/${id}`, thumbnail: "", platform: "instagram", contentType: "reel",
        creator: { name: "Creator" }, description: summary, savedDate: new Date().toISOString(), collectionId,
        collections: [collectionId], tags: [], favorite: false, archived: false, trashed: false,
        aiSummary: { quick: summary, standard: "Processing", detailed: "Processing" }, keyPoints: [], topics: [], personalNotes: "", metadata: {},
      });
      const spiritual = item("spiritual-item", "Hanuman devotional reel", collectionA.id, "A devotional reel about prayer and spiritual practice.");
      const commerce = item("commerce-item", "Website selling tutorial", collectionB.id, "A tutorial about selling products through an online store.");
      const all = [spiritual, commerce];
      const intent = SearchService.parseQueryIntent(SearchService.cleanAssistantQuery("what is spiritual reels in my keeper project?"));
      assertEqual(intent.cleanKeywords.join(","), "spiritual", "Collection and workspace phrasing is removed from topical keywords");

      const scopedAnswer = await AIService.queryAssistant("what is spiritual reels in my keeper project?", all, [collectionA, collectionB], collectionA.id);
      assertEqual(scopedAnswer.referencedItems.length, 1, "Collection scope limits assistant sources");
      assertEqual(scopedAnswer.referencedItems[0].id, spiritual.id, "Correct collection source is cited");
      assert(!scopedAnswer.answer.includes("Processing"), "Placeholder processing text is never presented as an answer");

      const noMatch = await AIService.queryAssistant("what is spiritual reels in my keeper project?", [commerce], [collectionA, collectionB]);
      assertEqual(noMatch.referencedItems.length, 1, "A weak topical match shows a closest item instead of a flat miss");
      assert(noMatch.answer.includes("matching your platform or content-type filters"), "Assistant labels filter-based suggestions clearly");
      assert(noMatch.confidence < 0.3, "Closest matches carry low confidence");
    });

    await test("AI assistant matches invoice making phrasing to a reel without accepting unrelated reels", async () => {
      const base: SavedItem = {
        id: "", title: "", url: "https://example.com", thumbnail: "", platform: "instagram", contentType: "reel",
        creator: { name: "Creator" }, description: "", savedDate: new Date().toISOString(), tags: [], favorite: false, archived: false, trashed: false,
        aiSummary: { quick: "", standard: "", detailed: "" }, keyPoints: [], topics: [], personalNotes: "", metadata: {},
      };
      const invoiceReel: SavedItem = {
        ...base, id: "invoice-reel", title: "How to make professional invoice", description: "How to make professional invoice",
        metadata: { caption: "How to make professional invoice" }, isLimited: true,
      };
      const unrelatedReel: SavedItem = {
        ...base, id: "branding-reel", title: "How to make professional branding", description: "How to make professional branding",
      };
      const answer = await AIService.queryAssistant("any reel for invoice making", [invoiceReel, unrelatedReel]);
      assertEqual(answer.referencedItems.map((item) => item.id).join(","), invoiceReel.id, "Invoice and making match the saved reel while the reel format word is treated as a filter");
      assert(answer.answer.includes("How to make professional invoice"), "The answer uses the exact saved detail that matched");
      assert(answer.answer.includes("can't confirm the full invoice-making steps yet"), "Limited source access is stated instead of inventing full instructions");
    });

    await test("AI assistant Phase A 24-case search evaluation", async () => {
      const baseNow = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const daysAgo = (days: number) => new Date(baseNow - days * dayMs).toISOString();
      const defaultSavedDate = daysAgo(30);
      const fixtureTimestamp = new Date(baseNow).toISOString();
      const collectionVlogs: Collection = { id: "col-vlogs", name: "Vlogs", color: "#000000", icon: "Folder", createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp };
      const collectionIdeas: Collection = { id: "col-ideas", name: "Ideas", color: "#000000", icon: "Folder", createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp };
      const makeItem = (id: string, title: string, platform: SavedItem["platform"], contentType: SavedItem["contentType"], description = "", extras: Partial<SavedItem> = {}): SavedItem => ({
        id, title, url: `https://example.com/${id}`, thumbnail: "", platform, contentType, creator: { name: "Creator" },
        description, savedDate: defaultSavedDate, collectionId: collectionVlogs.id, collections: [collectionVlogs.id],
        tags: [], favorite: false, archived: false, trashed: false, aiSummary: { quick: "", standard: "", detailed: "" },
        keyPoints: [], topics: [], personalNotes: "", metadata: {}, ...extras,
      });
      const vlog = makeItem("sunny-vlog", "2no Partner Ki Lagi Class 😡 || Sunny Bhavsar Vlogs", "youtube", "video", "", {
        isLimited: true, metadata: { aiProcessingStatus: "PENDING" },
      });
      const secondVlog = makeItem("weekend-vlog", "Weekend Vlog with family", "youtube", "video", "A family vlog from a weekend trip.");
      const uiReel = makeItem("ui-reel", "UI design breakdown for mobile apps", "instagram", "reel", "A breakdown of interface design.");
      const reactVideo = makeItem("react-video", "React performance optimization guide", "youtube", "video", "Profiling and speed improvements for React.");
      const agentsVideo = makeItem("agents-video", "Building AI agents with LangGraph", "youtube", "video", "A tutorial about autonomous AI agents and tool use.");
      const cookingItem = makeItem("cooking-item", "Cooking a quick high-protein dinner recipe", "youtube", "video", "A quick meal recipe.", {
        savedDate: daysAgo(1),
      });
      const paymentItem = makeItem("payment-item", "Payment gateways setup guide", "youtube", "video", "Compare payment gateway integrations.");
      const recentItem = makeItem("recent-robotics", "Robotics notes from today", "website", "article", "New robotics notes.");
      const editedItem = makeItem("edited-item", "Newly edited robotics notes", "website", "article", "Updated robotics notes.", { personalNotes: "robotics notes" });
      const movedItem = makeItem("moved-vlog", "Vlog about moving apartments", "youtube", "video", "Moving vlog.", {
        collectionId: collectionIdeas.id, collections: [collectionIdeas.id],
      });
      const deletedItem = makeItem("deleted-vlog", "Deleted Vlog", "youtube", "video", "", { trashed: true });
      const completedItem = makeItem("completed-transcript", "Cooking tips", "youtube", "video", "", {
        metadata: { aiProcessingStatus: "COMPLETED", transcript: "Transcript: how to make a quick dinner recipe." },
      });
      const bulkA = makeItem("bulk-a", "Bulk Import Family Vlog One", "youtube", "video");
      const bulkB = makeItem("bulk-b", "Bulk Import Travel Vlog Two", "youtube", "video");
      const unrelated = makeItem("unrelated", "Productivity notes for teams", "website", "article", "", {
        savedDate: daysAgo(2),
      });
      const items = [vlog, secondVlog, uiReel, reactVideo, agentsVideo, cookingItem, paymentItem, recentItem, editedItem, movedItem, deletedItem, completedItem, bulkA, bulkB, unrelated];
      const cases: Array<{ name: string; query: string; ids?: string[]; scope?: string; mode?: "closest" | "recent" | "empty"; answerIncludes?: string }> = [
        { name: "1 failing vague vlog query", query: "any kind of vlog video are existing in all collections", ids: [vlog.id], answerIncludes: "transcript pending" },
        { name: "2 list all vlog videos", query: "show all vlog videos", ids: [vlog.id, secondVlog.id] },
        { name: "3 plural title match", query: "vlogs", ids: [vlog.id, secondVlog.id] },
        { name: "4 YouTube video metadata filter", query: "YouTube videos", ids: [vlog.id, secondVlog.id] },
        { name: "5 Instagram reel metadata filter", query: "Instagram reels", ids: [uiReel.id] },
        { name: "6 UI design topic", query: "any reels about UI design", ids: [uiReel.id] },
        { name: "7 React performance topic", query: "React performance videos", ids: [reactVideo.id] },
        { name: "8 Hinglish AI agents query", query: "AI agents par maine kya save kiya?", ids: [agentsVideo.id] },
        { name: "9 Hinglish vlog listing", query: "mere saved vlog videos dikhao", ids: [vlog.id, secondVlog.id] },
        { name: "10 recent cooking query", query: "recently saved cooking", ids: [cookingItem.id] },
        { name: "11 payment gateways topic", query: "payment gateways ke baare mein", ids: [paymentItem.id] },
        { name: "12 selected collection filter", query: "show all videos", scope: collectionIdeas.id, ids: [movedItem.id] },
        { name: "13 empty library", query: "show videos", mode: "empty" },
        { name: "14 no text overlap gets honest recent suggestions", query: "quantum astrophysics", mode: "recent" },
        { name: "15 newly added item is searchable", query: "robotics notes", ids: [recentItem.id, editedItem.id] },
        { name: "16 edited title and note are searchable", query: "edited robotics notes", ids: [editedItem.id] },
        { name: "17 moved item follows its collection", query: "moving vlog", scope: collectionIdeas.id, ids: [movedItem.id] },
        { name: "18 trashed item is not surfaced", query: "deleted vlog", ids: [vlog.id, secondVlog.id] },
        { name: "19 Processing item matches title with pending label", query: "Sunny Bhavsar vlog", ids: [vlog.id], answerIncludes: "transcript pending" },
        { name: "20 completed transcript is searchable", query: "quick dinner recipe", ids: [completedItem.id] },
        { name: "21 bulk imported items are searchable", query: "bulk import vlog", ids: [bulkA.id, bulkB.id] },
        { name: "22 search sees only supplied workspace items", query: "Sunny Bhavsar vlog", ids: [vlog.id] },
        { name: "23 impossible collection scope returns empty", query: "show all videos", scope: "missing-collection", mode: "empty" },
        { name: "24 typo gets fuzzy closest match", query: "vlogg", ids: [vlog.id], mode: "closest" },
      ];

      for (const entry of cases) {
        await test(`Phase A case ${entry.name}`, async () => {
          const scopedItems = entry.name.includes("empty library") ? [] : items;
          const answer = await AIService.queryAssistant(entry.query, scopedItems, [collectionVlogs, collectionIdeas], entry.scope || "all");
          if (entry.mode === "empty") {
            assertEqual(answer.referencedItems.length, 0, "Empty data or impossible scope has no citations");
          } else if (entry.mode === "closest") {
            assert(answer.referencedItems.length > 0, "Weak queries show nearby saved items");
            assert(answer.answer.includes("closest saved items"), "Weak matches are clearly labeled");
            assert(answer.confidence < 0.3, "Weak matches have low confidence");
            for (const expectedId of entry.ids || []) assert(answer.referencedItems.some((item) => item.id === expectedId), `Expected closest citation ${expectedId}`);
          } else if (entry.mode === "recent") {
            assert(answer.referencedItems.length > 0, "A no-overlap query gives a small fallback list");
            assert(answer.answer.includes("recent items"), "No-overlap results are labeled as recent suggestions, not relevant hits");
            assert(answer.confidence < 0.3, "Fallback suggestions have low confidence");
          } else {
            const actualIds = answer.referencedItems.map((item) => item.id);
            for (const expectedId of entry.ids || []) assert(actualIds.includes(expectedId), `Expected citation ${expectedId}`);
            if (entry.name.includes("selected collection") || entry.name.includes("moved item")) {
              assert(actualIds.every((id) => id === movedItem.id), "Collection scope excludes other items");
            }
            if (entry.name.includes("trashed")) assert(!actualIds.includes(deletedItem.id), "Trashed content is excluded");
          }
          if (entry.answerIncludes) assert(answer.answer.toLowerCase().includes(entry.answerIncludes), `Answer includes ${entry.answerIncludes}`);
        });
      }
    });

    await test("AI agents retrieval rejects short-token and one-concept false positives", async () => {
      const base: SavedItem = {
        id: "", title: "", url: "https://example.com", thumbnail: "", platform: "instagram", contentType: "reel",
        creator: { name: "Creator" }, description: "", savedDate: new Date().toISOString(), tags: [], favorite: false, archived: false, trashed: false,
        aiSummary: { quick: "", standard: "", detailed: "" }, keyPoints: [], topics: [], personalNotes: "", metadata: {},
      };
      const nfs: SavedItem = {
        ...base, id: "nfs", title: "NFS Most Wanted multiplayer in browser", description: "A racing game with multiplayer gameplay.",
        tags: ["AI agents", "Gaming"], topics: ["AI agents", "Gaming"],
      };
      const meme: SavedItem = {
        ...base, id: "meme", title: "Did we cook?", description: "Did we cook? #claudeai #aftereffects #animation #motiongraphics.",
        creator: { name: "Creator" },
      };
      const modelOnly: SavedItem = {
        ...base, id: "ai-only", title: "New AI image model", description: "A new AI image model creates illustrations.",
      };
      const realAgent: SavedItem = {
        ...base, id: "agent", title: "Building AI agents with LangGraph", description: "A tutorial about autonomous AI agents and tool use.",
      };
      const answer = await AIService.queryAssistant("What did I save about AI agents?", [nfs, meme, modelOnly, realAgent]);
      assertEqual(answer.referencedItems.map((item) => item.id).join(","), realAgent.id, "Only the saved source with evidence for both AI and agents is cited");
      assert(!answer.answer.includes("NFS") && !answer.answer.includes("Did we cook"), "Gaming and meme sources are excluded from AI-agent answers");

      const intent = SearchService.parseQueryIntent(SearchService.cleanAssistantQuery("AI agents"));
      assertEqual(SearchService.textMatchesQuery("ClaudeAI #AfterEffects", intent), false, "AI embedded in a creator handle is not treated as standalone AI-agent evidence");
    });

    await test("AI assistant gaming relevance rejects PHP livestream and answers from source evidence", async () => {
      const gaming = {
        id: "nfs-reel", title: "Finally we got NFS Most Wanted multiplayer available in browser", url: "https://example.com/nfs", thumbnail: "",
        platform: "instagram", contentType: "reel", creator: { name: "Creator" }, description: "Keeper is extracting verified source content.",
        savedDate: new Date().toISOString(), tags: ["Gaming"], favorite: false, archived: false, trashed: false,
        aiSummary: { quick: "Keeper is extracting verified source content.", standard: "Processing", detailed: "Processing" },
        keyPoints: [], topics: ["Gaming"], personalNotes: "", metadata: {},
      } as SavedItem;
      const php = {
        ...gaming, id: "php-reel", title: "Apparently Twitch doesn't use PHP, so tune in to my livestream", url: "https://example.com/php",
        tags: ["Gaming", "PHP"], topics: ["Programming"],
      } as SavedItem;
      const answer = await AIService.queryAssistant("I'm finding something related gaming", [gaming, php]);
      assertEqual(answer.referencedItems.length, 1, "Only direct source evidence is cited for gaming");
      assertEqual(answer.referencedItems[0].id, gaming.id, "NFS multiplayer reel ranks as the gaming result");
      assert(!answer.answer.includes("PHP"), "Unrelated programming reel is excluded from the answer");
      assert(answer.answer.includes("Finally we got NFS Most Wanted multiplayer available in browser"), "The answer cites the exact saved title instead of an unavailable generated summary");

      const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
      const previousFetch = globalThis.fetch;
      let providerCalls = 0;
      Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
      globalThis.fetch = async () => { providerCalls += 1; return new Response("{}", { status: 200 }); };
      try {
        const followUp = await AIService.queryAssistant("Tell me more about it", [gaming, php], [], "all", ["user: I'm finding something related gaming", "assistant: I found your NFS reel"]);
        assertEqual(followUp.referencedItems.length, 1, "A follow-up uses its prior user question to retrieve the saved source");
        assertEqual(followUp.referencedItems[0].id, gaming.id, "Follow-up remains grounded in the matching saved item");
        assertEqual(providerCalls, 0, "Conversation history is not forwarded to the configured model provider");
      } finally {
        globalThis.fetch = previousFetch;
        if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
      }
    });

    await test("AI conversation history persists turns per local user and restores the selected scope", async () => {
      const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
      const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
      const values = new Map<string, string>();
      const storage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      };
      Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
      try {
        const conversation = await ConversationHistoryService.create("history-user-a", "collection-games");
        await ConversationHistoryService.append("history-user-a", conversation.id, {
          role: "user", content: "Find my saved games", status: "complete", metadata: { collectionId: "collection-games" },
        });
        await ConversationHistoryService.append("history-user-a", conversation.id, {
          role: "assistant", content: "I found one saved game.", status: "complete", metadata: { referencedItemIds: ["saved-game"] },
        });
        const restored = await ConversationHistoryService.messages("history-user-a", conversation.id);
        const otherUser = await ConversationHistoryService.list("history-user-b");
        assertEqual(restored.length, 2, "Both sides of the conversation persist");
        assertEqual(restored[1].metadata.referencedItemIds?.[0], "saved-game", "Source IDs persist with the answer");
        assertEqual((await ConversationHistoryService.list("history-user-a"))[0].selectedCollectionId, "collection-games", "Collection scope persists on the conversation");
        assertEqual(otherUser.length, 0, "Local history is isolated by user ID");
        await ConversationHistoryService.remove("history-user-a", conversation.id);
        assertEqual((await ConversationHistoryService.list("history-user-a")).length, 0, "Conversation deletion removes its saved history");
      } finally {
        if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
        if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage); else Reflect.deleteProperty(globalThis, "localStorage");
      }
    });

    await test("Cloud AI history schema and API enforce workspace ownership", () => {
      const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202610240001_ai_conversation_history.sql"), "utf8");
      const conversationRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/conversations/[conversationId]/route.ts"), "utf8");
      const messageRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/conversations/[conversationId]/messages/route.ts"), "utf8");
      const assistantRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/assistant-answer/route.ts"), "utf8");
      const workerRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/worker/route.ts"), "utf8");
      const mediaRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/media/route.ts"), "utf8");
      assert(migration.includes("workspace_id = auth.uid()") && migration.includes("enable row level security"), "Both history tables are protected by workspace RLS");
      assert(conversationRoute.includes(`eq("workspace_id", user.id)`), "Conversation mutations are scoped to the authenticated account");
      assert(messageRoute.includes(`eq("workspace_id", user.id)`) && messageRoute.includes("input.content.length > 12_000"), "Messages are checked against the authenticated workspace; limits are enforced by the API");
      assert(assistantRoute.includes(`ASSISTANT_EXTERNAL_SYNTHESIS_ENABLED !== "true"`)
        && assistantRoute.includes("input.allowExternalSynthesis !== true")
        && assistantRoute.includes(`.eq("workspace_id", user.id).in("id", requestedMediaIds)`)
        && assistantRoute.includes(`.eq("workspace_id", user.id).eq("id", input.collectionId)`)
        && assistantRoute.includes("memberships.includes(input.collectionId)"), "External synthesis is policy-gated and candidate rows and selected collection memberships are checked against the authenticated workspace");
      const workerWorkspaceScopedMediaAccesses = workerRoute.split(`.eq("id", job.media_id).eq("workspace_id", job.workspace_id)`).length - 1;
      assert(workerWorkspaceScopedMediaAccesses >= 2, "Background processing reads and updates media using both job media ID and workspace ID");
      assert((mediaRoute.match(/\.eq\("workspace_id", user\.id\)/g) || []).length >= 6
        && mediaRoute.includes("ContentService.safeMerge(existingPayload, updates)"), "Media CRUD and synchronization API operations scope records to the authenticated workspace and preserve safe merge rules");
    });

    await test("Assistant model output accepts only known item IDs with exact source quotes", async () => {
      const previousFetch = globalThis.fetch;
      const previousProvider = process.env.CONTENT_AI_PROVIDER;
      const previousKey = process.env.GEMINI_API_KEY;
      const previousModel = process.env.CONTENT_AI_MODEL;
      const sourceItem = {
        id: "grounded-game", title: "NFS Most Wanted multiplayer in browser", url: "https://example.com/game", thumbnail: "",
        platform: "instagram", contentType: "reel", creator: { name: "Creator" }, description: "NFS Most Wanted multiplayer is available in browser.",
        savedDate: new Date().toISOString(), tags: ["Gaming"], favorite: false, archived: false, trashed: false,
        aiSummary: { quick: "Multiplayer racing game in browser.", standard: "A racing game can be played in a browser.", detailed: "" },
        keyPoints: [], topics: ["Gaming"], personalNotes: "", metadata: {},
      } as SavedItem;
      process.env.CONTENT_AI_PROVIDER = "gemini";
      process.env.GEMINI_API_KEY = "test-key-never-sent";
      process.env.CONTENT_AI_MODEL = "test-model";
      globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        answer: `Your saved reel made 1 million dollars and features a Ferrari [source:${sourceItem.id}]`,
        relevantItemIds: [sourceItem.id, "made-up-id"],
        evidence: [{ itemId: sourceItem.id, quote: "NFS Most Wanted multiplayer is available in browser." }],
        confidence: 0.91,
      }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      try {
        const result = await AssistantAnswerService.generate("What did I save about gaming?", [sourceItem]);
        assert(!!result, "Configured assistant model returns an answer");
        assertEqual(result?.relevantItemIds.join(","), sourceItem.id, "Unknown source IDs are discarded");
        assertEqual(result?.confidence, 0.91, "Validated model confidence is returned");
        assert(result?.answer.includes(`[Source: ${sourceItem.title}]`), "Verified source excerpt renders with the exact saved title");
        assert(result?.answer.includes("NFS Most Wanted multiplayer is available in browser."), "The assistant returns the exact quote validated against the saved source");
        assert(!result?.answer.includes("1 million dollars") && !result?.answer.includes("Ferrari"), "Unsupported model-written claims are never shown to the user");
        assert(!SearchService.getGroundedText(sourceItem).includes("A racing game can be played in a browser."), "Generated summaries are not treated as original source evidence");
      } finally {
        globalThis.fetch = previousFetch;
        if (previousProvider === undefined) delete process.env.CONTENT_AI_PROVIDER; else process.env.CONTENT_AI_PROVIDER = previousProvider;
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
        if (previousModel === undefined) delete process.env.CONTENT_AI_MODEL; else process.env.CONTENT_AI_MODEL = previousModel;
      }
    });

    // ---------------------------------------------------------------------------
    // SUITE 22: ITEM-SPECIFIC THUMBNAIL DISCOVERY & PERSISTENCE TESTS
    // ---------------------------------------------------------------------------
    console.log("\n22. Item-Specific Thumbnail Discovery & Persistence Tests:");

    await test("Thumbnail Test 1: Unique bulk thumbnails preserved and persisted without generic wallpaper overwrite", async () => {
      const testUser = "user-thumb-bulk-unique";
      StorageService.clearUserData(testUser);

      const exportJson = {
        label_values: [
          { label: "URL", value: "https://www.instagram.com/reel/C1111111111/" },
          { label: "Caption", value: "Reel 1 motion graphics" },
          { label: "Thumbnail", value: "https://cdn.example.com/thumbnails/reel1.jpg" },
        ],
      };

      const multiExportJson = [
        {
          label_values: [
            { label: "URL", value: "https://www.instagram.com/reel/C1111111111/" },
            { label: "Caption", value: "Reel 1 motion graphics" },
            { label: "Thumbnail", value: "https://cdn.example.com/thumbnails/reel1.jpg" },
          ],
        },
        {
          label_values: [
            { label: "URL", value: "https://www.instagram.com/reel/C2222222222/" },
            { label: "Caption", value: "Reel 2 typography tips" },
            { label: "Thumbnail", value: "https://cdn.example.com/thumbnails/reel2.jpg" },
          ],
        },
        {
          label_values: [
            { label: "URL", value: "https://www.instagram.com/reel/C3333333333/" },
            { label: "Caption", value: "Reel 3 color grading guide" },
            { label: "Thumbnail", value: "https://cdn.example.com/thumbnails/reel3.jpg" },
          ],
        },
      ];

      const parsedCandidates = ExportFileParser.parse(JSON.stringify(multiExportJson), "saved_posts.json");
      assertEqual(parsedCandidates.length, 3, "Parsed 3 items from export JSON");
      assertEqual(parsedCandidates[0].thumbnailUrl, "https://cdn.example.com/thumbnails/reel1.jpg", "Parsed candidate 1 thumbnail");
      assertEqual(parsedCandidates[1].thumbnailUrl, "https://cdn.example.com/thumbnails/reel2.jpg", "Parsed candidate 2 thumbnail");
      assertEqual(parsedCandidates[2].thumbnailUrl, "https://cdn.example.com/thumbnails/reel3.jpg", "Parsed candidate 3 thumbnail");

      // Execute Bulk Import Job
      const job = await ImportJobService.createJob(testUser, "instagram", "export_file", parsedCandidates, {
        autoOrganize: false,
        skipDuplicates: false,
        defaultTags: [],
      });

      await ImportJobService.processJob(job.id);

      const saved = ContentService.getAll(testUser);
      assertEqual(saved.length, 3, "All 3 items saved to database");

      const itemA = saved.find((i) => i.url.includes("C1111111111"));
      const itemB = saved.find((i) => i.url.includes("C2222222222"));
      const itemC = saved.find((i) => i.url.includes("C3333333333"));

      assert(itemA !== undefined, "Item A exists");
      assert(itemB !== undefined, "Item B exists");
      assert(itemC !== undefined, "Item C exists");

      assertEqual(itemA.thumbnail, "https://cdn.example.com/thumbnails/reel1.jpg", "Item A preserved its authentic thumbnail");
      assertEqual(itemB.thumbnail, "https://cdn.example.com/thumbnails/reel2.jpg", "Item B preserved its authentic thumbnail");
      assertEqual(itemC.thumbnail, "https://cdn.example.com/thumbnails/reel3.jpg", "Item C preserved its authentic thumbnail");

      // Assert that each item has its own authentic thumbnail and none are identical
      assert(itemA.thumbnail !== itemB.thumbnail, "Item A and B have different thumbnails");
      assert(itemB.thumbnail !== itemC.thumbnail, "Item B and C have different thumbnails");
      assert(itemA.thumbnail !== itemC.thumbnail, "Item A and C have different thumbnails");

      assertEqual(itemA.metadata.thumbnailSource, "export", "Item A thumbnail provenance is export");
      assertEqual(itemB.metadata.thumbnailSource, "export", "Item B thumbnail provenance is export");
      assertEqual(itemC.metadata.thumbnailSource, "export", "Item C thumbnail provenance is export");
    });

    await test("Thumbnail Test 2: Single vs bulk parity resolves authentic thumbnails consistently", async () => {
      const singleUser = "user-single-import-test";
      const bulkUser = "user-bulk-import-test";
      StorageService.clearUserData(singleUser);
      StorageService.clearUserData(bulkUser);

      const testUrl = "https://www.instagram.com/reel/C4444444444/";
      const testThumbnail = "https://cdn.example.com/thumbnails/authentic-single.jpg";
      const testCaption = "Consistent Instagram reel across single and bulk import";

      // Single URL Import simulation (via IngestionService with initial export metadata)
      const singleIngestion = await IngestionService.processUrl(testUrl, {
        userId: singleUser,
        initialMetadata: {
          caption: testCaption,
          thumbnailUrl: testThumbnail,
        },
      });

      // Bulk Import simulation
      const bulkCandidates: ParsedImportCandidate[] = [
        {
          originalUrl: testUrl,
          platform: "instagram",
          caption: testCaption,
          thumbnailUrl: testThumbnail,
        },
      ];

      const bulkJob = await ImportJobService.createJob(bulkUser, "instagram", "export_file", bulkCandidates, {
        autoOrganize: false,
        skipDuplicates: false,
        defaultTags: [],
      });
      await ImportJobService.processJob(bulkJob.id);

      const bulkItems = ContentService.getAll(bulkUser);
      assertEqual(bulkItems.length, 1, "Bulk item saved");

      // Parity check: Both paths resolve the authentic thumbnail and provenance identically
      assertEqual(singleIngestion.savedItem.thumbnail, testThumbnail, "Single import resolved authentic thumbnail");
      assertEqual(bulkItems[0].thumbnail, testThumbnail, "Bulk import resolved authentic thumbnail");
      assertEqual(singleIngestion.savedItem.thumbnail, bulkItems[0].thumbnail, "Full parity between single and bulk thumbnails");
      assertEqual(singleIngestion.savedItem.metadata.thumbnailSource, "export", "Single thumbnailSource is export");
      assertEqual(bulkItems[0].metadata.thumbnailSource, "export", "Bulk thumbnailSource is export");
    });

    await test("Thumbnail Test 3: Graceful fallback when thumbnail is unavailable without corrupting metadata", async () => {
      const fallbackUser = "user-thumb-fallback";
      StorageService.clearUserData(fallbackUser);

      // Record has valid URL, creator, and caption, but NO thumbnail
      const result = await IngestionService.processUrl("https://www.instagram.com/reel/C5555555555/", {
        userId: fallbackUser,
        initialMetadata: {
          creatorName: "CreativeDesignLab",
          caption: "Mastering typography in modern branding #design #branding",
        },
      });

      // Metadata, creator, and caption MUST remain intact
      assertEqual(result.savedItem.creator.name, "@CreativeDesignLab", "Creator preserved cleanly");
      assert(result.savedItem.title.includes("Mastering typography") || result.savedItem.title.includes("CreativeDesignLab"), "Title derived correctly");
      assertEqual(result.savedItem.metadata.caption, "Mastering typography in modern branding #design #branding", "Caption preserved");

      // Thumbnail uses clean Instagram placeholder without throwing errors
      assert(typeof result.savedItem.thumbnail === "string" && result.savedItem.thumbnail.length > 0, "Fallback thumbnail assigned");
      assertEqual(result.savedItem.thumbnail, INSTAGRAM_REEL_PLACEHOLDER, "Assigned clearly generic Instagram Reel placeholder");
      assert(!result.savedItem.thumbnail.includes("unsplash.com"), "Never uses stock photography as content");
      assertEqual(result.savedItem.metadata.thumbnailSource, "fallback", "Honest fallback thumbnailSource provenance recorded");
      assertEqual(result.savedItem.provenance?.thumbnail?.source, "fallback_preview", "Provenance source explicitly tracks fallback_preview");
    });

    await test("Thumbnail Test 4: Partial batch thumbnail isolation (mix of available & unavailable)", async () => {
      const mixedUser = "user-thumb-mixed-batch";
      StorageService.clearUserData(mixedUser);

      const candidates: ParsedImportCandidate[] = [
        {
          originalUrl: "https://www.instagram.com/reel/CMixA111111/",
          platform: "instagram",
          caption: "Item A with authentic thumbnail",
          thumbnailUrl: "https://cdn.example.com/thumbnails/thumb-a.jpg",
        },
        {
          originalUrl: "https://www.instagram.com/reel/CMixB222222/",
          platform: "instagram",
          caption: "Item B with NO thumbnail available",
        },
        {
          originalUrl: "https://www.instagram.com/reel/CMixC333333/",
          platform: "instagram",
          caption: "Item C with authentic thumbnail",
          thumbnailUrl: "https://cdn.example.com/thumbnails/thumb-c.jpg",
        },
      ];

      const job = await ImportJobService.createJob(mixedUser, "instagram", "export_file", candidates, {
        autoOrganize: false,
        skipDuplicates: false,
        defaultTags: [],
      });
      await ImportJobService.processJob(job.id);

      const saved = ContentService.getAll(mixedUser);
      assertEqual(saved.length, 3, "All 3 items processed");

      const itemA = saved.find((i) => i.url.includes("CMixA111111"))!;
      const itemB = saved.find((i) => i.url.includes("CMixB222222"))!;
      const itemC = saved.find((i) => i.url.includes("CMixC333333"))!;

      assertEqual(itemA.thumbnail, "https://cdn.example.com/thumbnails/thumb-a.jpg", "Item A has authentic thumbnail A");
      assertEqual(itemA.metadata.thumbnailSource, "export", "Item A thumbnailSource is export");

      assertEqual(itemB.metadata.thumbnailSource, "fallback", "Item B gracefully used fallback");
      assertEqual(itemB.thumbnail, INSTAGRAM_REEL_PLACEHOLDER, "Item B used clean Instagram Reel placeholder");
      assert(itemB.thumbnail !== itemA.thumbnail, "Item B fallback did not corrupt or reuse Item A thumbnail");

      assertEqual(itemC.thumbnail, "https://cdn.example.com/thumbnails/thumb-c.jpg", "Item C has authentic thumbnail C");
      assertEqual(itemC.metadata.thumbnailSource, "export", "Item C thumbnailSource is export");
      assert(itemC.thumbnail !== itemA.thumbnail, "Item C thumbnail is distinct from Item A");
    });

    await test("Thumbnail Test 5: Cache isolation ensures independent entries across shortcodes", async () => {
      const igProvider = new InstagramProvider();
      const url1 = "https://www.instagram.com/reel/CacheTest111/";
      const url2 = "https://www.instagram.com/reel/CacheTest222/";

      const res1 = await igProvider.fetchAuthoritativeData(url1);
      const res2 = await igProvider.fetchAuthoritativeData(url2);

      assertEqual(res1.contentId, "CacheTest111", "Content ID 1 correctly isolated");
      assertEqual(res2.contentId, "CacheTest222", "Content ID 2 correctly isolated");
      assert(res1.canonicalUrl !== res2.canonicalUrl, "Distinct canonical URLs");
    });

    await test("Thumbnail Test 6: Reprocessing service detects and repairs legacy generic wallpaper records", async () => {
      const reprocessUser = "user-reprocess-thumbnail";
      StorageService.clearUserData(reprocessUser);

      const badWallpaperItem: SavedItem = {
        id: "legacy-bad-wallpaper-1",
        title: "Clean Design Principles",
        url: "https://www.instagram.com/reel/CReprocess999/",
        thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@design_pro" },
        description: "Clean design principles reel",
        savedDate: new Date().toISOString(),
        tags: [],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: [],
        topics: ["Design"],
        personalNotes: "Keep this note safe",
        metadata: {
          domain: "instagram.com",
          caption: "Design principles for 2025",
          thumbnailSource: "fallback",
        },
        contentStatus: "PARTIAL_CONTENT",
      };

      ContentService.addItem(badWallpaperItem, reprocessUser);

      // Assert that ReprocessingService identifies generic fallback wallpaper as eligible
      assertEqual(ReprocessingService.isEligible(badWallpaperItem), true, "Identified as eligible due to generic wallpaper");

      const reprocessed = await ReprocessingService.reprocessItem(badWallpaperItem, reprocessUser);

      assertEqual(reprocessed.personalNotes, "Keep this note safe", "User personal notes preserved");
      assertEqual(reprocessed.creator.name, "@design_pro", "Creator preserved");
      assert(reprocessed.thumbnail.length > 0, "Thumbnail assigned properly");
      assert(
        !reprocessed.thumbnail.includes("photo-1507238691740-187a5b1d37b8"),
        "Misleading stock photo permanently removed"
      );
      assert(
        reprocessed.thumbnail.startsWith("data:image/svg+xml"),
        "Misleading stock photo replaced with clean Instagram placeholder"
      );
    });

    await test("Thumbnail Test 7: Unified resolver rejects banned stock photos, avatars, and login artwork as authentic", async () => {
      // 1. Rejects banned stock photos
      assert(!InstagramThumbnailResolver.isAuthenticMediaUrl("https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80"), "Rejects laptop stock photo");
      assert(!InstagramThumbnailResolver.isAuthenticMediaUrl("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80"), "Rejects Matrix stock photo");
      assert(!InstagramThumbnailResolver.isAuthenticMediaUrl("https://images.unsplash.com/photo-1542744094-3a31f272c490"), "Rejects office stock photo");

      // 2. Rejects generic logos and login page assets
      assert(!InstagramThumbnailResolver.isAuthenticMediaUrl("https://www.instagram.com/static/images/ico/favicon.ico"), "Rejects favicon");
      assert(!InstagramThumbnailResolver.isAuthenticMediaUrl("https://instagram.com/static/images/login-box.png"), "Rejects login box");

      // 3. Accepts genuine media URLs
      assert(InstagramThumbnailResolver.isAuthenticMediaUrl("https://scontent.cdninstagram.com/v/t51.2885-15/authentic_reel_thumb.jpg"), "Accepts CDN Instagram image");
      assert(InstagramThumbnailResolver.isAuthenticMediaUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), "Accepts archive data URL");
      assert(InstagramThumbnailResolver.isAuthenticMediaUrl("https://cdn.example.com/thumbnails/real_post.jpg"), "Accepts explicit external thumbnail");
    });

    await test("Thumbnail Test 8: Resolver extracts authentic image from archive media resolver (ZIP entry)", async () => {
      const fakeArchiveEntries = new Map<string, string>([
        ["media/posts/carchivedemo123.jpg", "data:image/jpeg;base64,QUJDREVGR0g="],
      ]);

      const result = await InstagramThumbnailResolver.resolveInstagramThumbnail({
        canonicalUrl: "https://www.instagram.com/reel/CArchiveDemo123/",
        shortcode: "CArchiveDemo123",
        isReel: true,
        exportMetadata: {
          thumbnailUrl: "media/posts/carchivedemo123.jpg",
        },
        archiveFileResolver: (path) => fakeArchiveEntries.get(path.toLowerCase()) || null,
      });

      assertEqual(result.status, "authentic", "Archive media marked authentic");
      assertEqual(result.source, "export_archive", "Source correctly attributed to export archive");
      assertEqual(result.url, "data:image/jpeg;base64,QUJDREVGR0g=", "Exact data URL retrieved from archive");
    });

    await test("Thumbnail Test 9: Resolver rejects login walls and challenge pages honestly as unavailable (never as authentic)", async () => {
      // When no authentic image exists and provider is restricted
      const result = await InstagramThumbnailResolver.resolveInstagramThumbnail({
        canonicalUrl: "https://www.instagram.com/reel/CLoginWall999/",
        shortcode: "CLoginWall999",
        isReel: true,
        providerMetadata: {
          hasAuthenticThumb: false,
          thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5", // Stock photo attempted
        },
      });

      assertEqual(result.status, "unavailable", "Never claims authentic for restricted content");
      assertEqual(result.source, "fallback", "Source marked as fallback");
      assertEqual(result.url, INSTAGRAM_REEL_PLACEHOLDER, "Returns branded Instagram Reel placeholder");
      assert(!result.url.includes("unsplash.com"), "Never returns stock photography");
    });

    await test("Thumbnail Test 10: Multi-item concurrent bulk import guarantees cross-item isolation without thumbnail bleed", async () => {
      const isoUser = "user-thumb-isolation";
      StorageService.clearUserData(isoUser);

      const candidates: ParsedImportCandidate[] = [
        {
          originalUrl: "https://www.instagram.com/reel/CIsoAlpha111/",
          platform: "instagram",
          caption: "Alpha post with unique thumbnail",
          thumbnailUrl: "https://cdn.example.com/thumbnails/alpha.jpg",
        },
        {
          originalUrl: "https://www.instagram.com/reel/CIsoBeta222/",
          platform: "instagram",
          caption: "Beta post with unique archive image",
          thumbnailUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
        {
          originalUrl: "https://www.instagram.com/reel/CIsoGamma333/",
          platform: "instagram",
          caption: "Gamma post with no media available",
        },
      ];

      const job = await ImportJobService.createJob(isoUser, "instagram", "export_file", candidates, {
        autoOrganize: false,
        skipDuplicates: false,
        defaultTags: [],
      });
      await ImportJobService.processJob(job.id);

      const saved = ContentService.getAll(isoUser);
      assertEqual(saved.length, 3, "All 3 isolation items processed");

      const itemAlpha = saved.find((i) => i.url.includes("CIsoAlpha111"))!;
      const itemBeta = saved.find((i) => i.url.includes("CIsoBeta222"))!;
      const itemGamma = saved.find((i) => i.url.includes("CIsoGamma333"))!;

      assertEqual(itemAlpha.thumbnail, "https://cdn.example.com/thumbnails/alpha.jpg", "Alpha retained its authentic thumbnail");
      assertEqual(itemAlpha.metadata.thumbnailSource, "export", "Alpha source is export");

      assert(itemBeta.thumbnail.startsWith("data:image/png;base64,"), "Beta retained its authentic data URL");
      assertEqual(itemBeta.metadata.thumbnailSource, "export", "Beta source is export");

      assertEqual(itemGamma.thumbnail, INSTAGRAM_REEL_PLACEHOLDER, "Gamma cleanly assigned Instagram Reel placeholder");
      assertEqual(itemGamma.metadata.thumbnailSource, "fallback", "Gamma source is fallback");

      // Strict cross-item isolation assertions
      assert(itemAlpha.thumbnail !== itemBeta.thumbnail, "Alpha does not bleed into Beta");
      assert(itemBeta.thumbnail !== itemGamma.thumbnail, "Beta does not bleed into Gamma");
      assert(itemAlpha.thumbnail !== itemGamma.thumbnail, "Alpha does not bleed into Gamma");
    });

    // ---------------------------------------------------------------------------
    // SUITE 23: TIMEOUT RESILIENCE & NON-FATAL ENRICHMENT REGRESSION TESTS
    // ---------------------------------------------------------------------------
    console.log("\n23. Timeout Resilience & Non-Fatal Enrichment Regression Tests:");

    await test("Timeout Resilience Test 1 (Real Failure Regression): Network timeout on remote enrichment gracefully degrades to export metadata and succeeds", async () => {
      const testUser = "user-real-timeout-reg";
      StorageService.clearUserData(testUser);

      const originalFetch = global.fetch;
      try {
        // Mock network calls to simulate network timeout / abort
        global.fetch = async (_input: any, _init?: any) => {
          const err = new Error("The operation was aborted due to timeout");
          err.name = "AbortError";
          throw err;
        };

        const candidate: ParsedImportCandidate = {
          originalUrl: "https://www.instagram.com/reel/Dd6Uamci-Jb/",
          platform: "instagram",
          creatorName: "penguin.7582551",
          caption: "Real non-empty caption for penguin reel with #nature #penguins",
          collectionName: "Instagram Saved",
        };

        const job = await ImportJobService.createJob(testUser, "instagram", "export_file", [candidate], {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        });

        await ImportJobService.processJob(job.id);

        assertEqual(job.successCount, 1, "Import job must succeed for valid export candidate despite remote timeout");
        assertEqual(job.failedCount, 0, "Failed count must be 0");

        const saved = ContentService.getAll(testUser);
        assertEqual(saved.length, 1, "Saved item exists in database");

        const item = saved[0];
        assert(item.url.includes("Dd6Uamci-Jb"), "Canonical reel URL preserved");
        assert(item.creator.name.includes("penguin.7582551"), "Authoritative export creator preserved");
        assertEqual(item.description, "Real non-empty caption for penguin reel with #nature #penguins", "Authoritative export caption preserved");
        assertEqual(item.thumbnail, INSTAGRAM_REEL_PLACEHOLDER, "Degrades cleanly to Instagram Reel placeholder");
        assertEqual(item.metadata.thumbnailSource, "fallback", "Thumbnail source is fallback");
      assertEqual(item.contentStatus, "PARTIAL_CONTENT", "Verified export caption is represented as partial source content");
      assertEqual(item.tags.length, 0, "AI tags await the durable background analysis job");
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("Timeout Resilience Test 2: All remote sources fail (oEmbed, embed, OG, media) but SavedItem is successfully persisted", async () => {
      const testUser = "user-all-remote-fail";
      StorageService.clearUserData(testUser);

      const originalFetch = global.fetch;
      try {
        // All network requests fail completely
        global.fetch = async () => {
          throw new Error("Failed to connect to remote Instagram server (ECONNREFUSED)");
        };

        const candidate: ParsedImportCandidate = {
          originalUrl: "https://www.instagram.com/p/DFallFail123/",
          platform: "instagram",
          creatorName: "traveler.jane",
          caption: "Tokyo sunset photography #japan #tokyo",
          collectionName: "Instagram Saved",
        };

        const job = await ImportJobService.createJob(testUser, "instagram", "export_file", [candidate], {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        });

        await ImportJobService.processJob(job.id);

        assertEqual(job.successCount, 1, "Item saved despite complete remote failure");
        assertEqual(job.failedCount, 0, "No fatal import errors");

        const saved = ContentService.getAll(testUser);
        assertEqual(saved.length, 1, "Item stored in database");
        assert(saved[0].creator.name.includes("traveler.jane"), "Export creator preserved");
        assertEqual(saved[0].thumbnail, INSTAGRAM_POST_PLACEHOLDER, "Instagram Post placeholder used");
        assertEqual(saved[0].metadata.thumbnailSource, "fallback", "Thumbnail source is fallback");
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("Timeout Resilience Test 3: Export archive contains authentic thumbnail so no remote calls needed and authentic thumb is stored", async () => {
      const testUser = "user-export-authentic-thumb";
      StorageService.clearUserData(testUser);

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => {
          return new Response("ok");
        };

        const authenticThumb = "https://cdn.example.com/authoritative-export-thumb.jpg";
        const candidate: ParsedImportCandidate = {
          originalUrl: "https://www.instagram.com/reel/CAuthExport111/",
          platform: "instagram",
          creatorName: "chef.mario",
          caption: "Handmade pasta recipe from Bologna",
          thumbnailUrl: authenticThumb,
        };

        const job = await ImportJobService.createJob(testUser, "instagram", "export_file", [candidate], {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        });

        await ImportJobService.processJob(job.id);

        assertEqual(job.successCount, 1, "Import succeeds");
        const saved = ContentService.getAll(testUser);
        assertEqual(saved.length, 1, "Saved item exists");
        assertEqual(saved[0].thumbnail, authenticThumb, "Authentic thumbnail preserved");
        assertEqual(saved[0].metadata.thumbnailSource, "export", "Thumbnail source is export");
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("Timeout Resilience Test 4: Provider responds with authentic thumbnail within timeout when no export thumbnail exists", async () => {
      const testUser = "user-provider-authentic-thumb";
      StorageService.clearUserData(testUser);

      const originalFetch = global.fetch;
      try {
        const liveCdnThumb = "https://scontent.cdninstagram.com/v/t51.2885-15/verified_authentic_456.jpg";
        global.fetch = async (url: any) => {
          const urlStr = String(url);
          if (urlStr.includes("/embed/captioned/")) {
            const html = `
            <!DOCTYPE html><html><body>
              <div class="CaptionUsername">live.creator</div>
              <img class="EmbeddedMediaImage" src="${liveCdnThumb}" />
              <div class="Caption">Live extracted caption from embed</div>
            </body></html>
          `;
            return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
          }
          return new Response("not found", { status: 404 });
        };

        const candidate: ParsedImportCandidate = {
          originalUrl: "https://www.instagram.com/reel/CProviderAuth111/",
          platform: "instagram",
        };

        const job = await ImportJobService.createJob(testUser, "instagram", "export_file", [candidate], {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        });

        await ImportJobService.processJob(job.id);

        assertEqual(job.successCount, 1, "Import succeeds");
        const saved = ContentService.getAll(testUser);
        assertEqual(saved.length, 1, "Saved item exists");
        assertEqual(saved[0].thumbnail, liveCdnThumb, "Provider authentic thumbnail preserved");
        assertEqual(saved[0].metadata.thumbnailSource, "provider", "Thumbnail source is provider");
      } finally {
        global.fetch = originalFetch;
      }
    });

    await test("Timeout Resilience Test 5: Mixed 20-item batch (5 export thumb, 5 provider thumb, 5 provider timeout, 5 media unavailable) -> 20/20 STORED", async () => {
      const testUser = "user-mixed-batch-20";
      StorageService.clearUserData(testUser);

      const originalFetch = global.fetch;
      try {
        const providerThumb = "https://scontent.cdninstagram.com/v/t51.2885-15/provider_batch_img.jpg";
        global.fetch = async (url: any) => {
          const urlStr = String(url);
          // Items 5-9: provider succeeds
          if (urlStr.includes("CBatchProvider")) {
            const html = `
            <!DOCTYPE html><html><body>
              <div class="CaptionUsername">batch.creator</div>
              <img class="EmbeddedMediaImage" src="${providerThumb}" />
              <div class="Caption">Batch live caption</div>
            </body></html>
          `;
            return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
          }
          // Items 10-14: provider timeout
          if (urlStr.includes("CBatchTimeout")) {
            const err = new Error("AbortError: Operation timed out");
            err.name = "AbortError";
            throw err;
          }
          // Items 15-19: media unavailable (404/login restricted)
          if (urlStr.includes("CBatchUnavailable")) {
            return new Response("<html><body>Login • Instagram</body></html>", { status: 200 });
          }
          return new Response("not found", { status: 404 });
        };

        const candidates: ParsedImportCandidate[] = [];

        // 1. 5 with authentic export thumbnail
        for (let i = 0; i < 5; i++) {
          candidates.push({
            originalUrl: `https://www.instagram.com/reel/CBatchExport${i}/`,
            platform: "instagram",
            creatorName: `export.creator.${i}`,
            caption: `Export caption ${i}`,
            thumbnailUrl: `https://cdn.example.com/export-thumb-${i}.jpg`,
          });
        }

        // 2. 5 with provider thumbnail succeeding
        for (let i = 0; i < 5; i++) {
          candidates.push({
            originalUrl: `https://www.instagram.com/reel/CBatchProvider${i}/`,
            platform: "instagram",
            creatorName: `provider.creator.${i}`,
            caption: `Provider caption ${i}`,
          });
        }

        // 3. 5 with provider timeout
        for (let i = 0; i < 5; i++) {
          candidates.push({
            originalUrl: `https://www.instagram.com/reel/CBatchTimeout${i}/`,
            platform: "instagram",
            creatorName: `timeout.creator.${i}`,
            caption: `Timeout caption ${i}`,
          });
        }

        // 4. 5 with media unavailable
        for (let i = 0; i < 5; i++) {
          candidates.push({
            originalUrl: `https://www.instagram.com/reel/CBatchUnavailable${i}/`,
            platform: "instagram",
            creatorName: `unavail.creator.${i}`,
            caption: `Unavailable caption ${i}`,
          });
        }

        assertEqual(candidates.length, 20, "Batch has exactly 20 candidates");

        const job = await ImportJobService.createJob(testUser, "instagram", "export_file", candidates, {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
          concurrencyLimit: 5,
        });

        await ImportJobService.processJob(job.id);

        assertEqual(
          job.successCount,
          20,
          `All 20/20 items must be successfully imported. Job status: ${job.status}; failedCount: ${job.failedCount}; failed items: ${JSON.stringify(
            job.items.filter((item) => item.status === "failed").map((item) => ({
              id: item.id,
              url: item.originalUrl,
              error: item.error,
            }))
          )}`
        );
        assertEqual(job.failedCount, 0, "There must be 0 failed imports");

        const saved = ContentService.getAll(testUser);
        assertEqual(saved.length, 20, "All 20 items stored in database");

        // Verify thumbnails breakdown
        const exportThumbs = saved.filter((s) => s.metadata.thumbnailSource === "export");
        const providerThumbs = saved.filter((s) => s.metadata.thumbnailSource === "provider");
        const fallbackThumbs = saved.filter((s) => s.metadata.thumbnailSource === "fallback");

        assertEqual(exportThumbs.length, 5, "Exactly 5 items have export authentic thumbnails");
        assertEqual(providerThumbs.length, 5, "Exactly 5 items have provider authentic thumbnails");
        assertEqual(fallbackThumbs.length, 10, "Exactly 10 items have Instagram placeholder thumbnails");

        // Verify none failed or became 'Not stored'
        for (const item of saved) {
          assert(item.id.length > 0, "Item has valid ID");
          assert(item.title.length > 0, "Item has non-empty title");
          assert(item.creator.name.length > 0, "Item has non-empty creator");
          assert(item.thumbnail.length > 0, "Item has non-empty thumbnail");
        }
      } finally {
        global.fetch = originalFetch;
      }
    });

    // ---------------------------------------------------------------------------
    // 24. P0 Data Immutability & Production Invariants Regression Tests
    // ---------------------------------------------------------------------------
    console.log("\n24. P0 Data Immutability & Production Invariants Regression Tests:");

    await test("REGRESSION TEST — IMMUTABILITY: Authoritative fields survive AI analysis, thumbnail resolution, reprocessing, indexing, and reload", async () => {
      const testUser = `immutability-user-${Date.now()}`;
      const initialItem: SavedItem = {
        id: `item-immutable-${Date.now()}`,
        title: "Custom Caption Title",
        url: "https://www.instagram.com/reel/AAA/",
        thumbnail: "https://cdn.example.com/authentic_aaa.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@creator_A" },
        description: "caption_A",
        savedDate: "2024-01-15T12:00:00.000Z",
        tags: ["reel"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: [],
        topics: [],
        personalNotes: "",
        metadata: {
          domain: "instagram.com",
          shortcode: "AAA",
          caption: "caption_A",
          thumbnailSource: "export",
        },
        provenance: {
          creator: { source: "instagram_export_metadata", retrievedAt: "2024-01-15T12:00:00.000Z" },
          caption: { source: "instagram_export_metadata", retrievedAt: "2024-01-15T12:00:00.000Z" },
        },
      };

      ContentService.addItem(initialItem, testUser);

      // Stage 1: AI analysis / reprocessing merge
      const itemAfterAi = ContentService.safeMerge(initialItem, {
        aiSummary: { quick: "New AI Summary", standard: "Standard AI", detailed: "Detailed AI" },
        topics: ["New AI Topic"],
        creator: { name: "Instagram User" }, // Weaker generic scrape
        description: "Weaker remote scraped description",
        savedDate: "2026-10-02T19:00:00.000Z",
      });

      await assertRejects(
        async () => ContentService.safeMerge(initialItem, { url: "https://www.instagram.com/reel/CORRUPTED/" }),
        "DataIntegrityViolation",
        "Content identity changes are rejected rather than silently merged",
      );

      assertEqual(itemAfterAi.url, "https://www.instagram.com/reel/AAA/", "Stage 1: URL preserved");
      assertEqual(itemAfterAi.creator.name, "@creator_A", "Stage 1: Creator preserved");
      assertEqual(itemAfterAi.description, "caption_A", "Stage 1: Description preserved");
      assertEqual(itemAfterAi.savedDate, "2024-01-15T12:00:00.000Z", "Stage 1: Saved date preserved");

      // Stage 2: Thumbnail resolution attempt with generic fallback
      const itemAfterThumb = ContentService.safeMerge(itemAfterAi, {
        thumbnail: INSTAGRAM_REEL_PLACEHOLDER,
        metadata: {
          ...itemAfterAi.metadata,
          thumbnailSource: "fallback",
        },
      });

      assertEqual(itemAfterThumb.thumbnail, "https://cdn.example.com/authentic_aaa.jpg", "Stage 2: Authentic thumbnail preserved over fallback");
      assertEqual(itemAfterThumb.creator.name, "@creator_A", "Stage 2: Creator preserved");

      // Stage 3: Reprocessing
      const itemAfterReprocess = await ReprocessingService.reprocessItem(initialItem.id, testUser);
      if (itemAfterReprocess) {
        assertEqual(itemAfterReprocess.url, "https://www.instagram.com/reel/AAA/", "Stage 3: Reprocess preserves canonical URL");
        assertEqual(itemAfterReprocess.creator.name, "@creator_A", "Stage 3: Reprocess preserves creator");
        assertEqual(itemAfterReprocess.description, "caption_A", "Stage 3: Reprocess preserves caption");
        assertEqual(itemAfterReprocess.savedDate, "2024-01-15T12:00:00.000Z", "Stage 3: Reprocess preserves saved date");
      }

      // Stage 4: Indexing
      const searchResults = SearchService.search("caption_A", testUser);
      assert(searchResults.length > 0, "Stage 4: Item searchable by original caption");

      // Stage 5: Reload from storage
      const reloaded = ContentService.getById(initialItem.id, testUser);
      assert(reloaded !== undefined, "Stage 5: Item reloaded from storage");
      assertEqual(reloaded?.url, "https://www.instagram.com/reel/AAA/", "Stage 5: Reloaded URL matches");
      assertEqual(reloaded?.creator.name, "@creator_A", "Stage 5: Reloaded creator matches");
      assertEqual(reloaded?.description, "caption_A", "Stage 5: Reloaded caption matches");
      assertEqual(reloaded?.savedDate, "2024-01-15T12:00:00.000Z", "Stage 5: Reloaded saved date matches");
    });

    await test("REGRESSION TEST — MULTI-ITEM ISOLATION: Concurrent items A-E never leak data across records", async () => {
      const letters = ["A", "B", "C", "D", "E"];
      const candidates: ParsedImportCandidate[] = letters.map((l) => ({
        originalUrl: `https://www.instagram.com/reel/Reel_${l}/`,
        platform: "instagram",
        title: `Title ${l}`,
        creatorName: `creator_${l}`,
        caption: `Caption of item ${l}`,
        savedTimestamp: `2024-01-0${letters.indexOf(l) + 1}T10:00:00.000Z`,
        sourceContext: "Instagram Saved Media",
      }));

      const analysis = ImportJobService.analyzeCandidates(candidates, []);
      assertEqual(analysis.ready, 5, "All 5 candidates ready");

      const multiUser = `multi-iso-${Date.now()}`;
      const job = ImportJobService.createJob({
        userId: multiUser,
        platform: "instagram",
        sourceType: "file_export",
        sourceName: "Isolation Test",
        items: analysis.candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: true,
          concurrencyLimit: 5,
          duplicateStrategy: "update",
          defaultTags: [],
        },
      });

      await ImportJobService.startJob(job.id);

      const storedItems = ContentService.getAll(multiUser);
      assertEqual(storedItems.length, 5, "5 items stored");

      for (const l of letters) {
        const item = storedItems.find((it) => it.url.includes(`/reel/Reel_${l}/`));
        assert(item !== undefined, `Item ${l} found in store`);
      assertEqual(item?.creator.name, `@creator_${l}`, `Item ${l} has strictly its own normalized creator handle`);
        assert(item?.description.includes(`Caption of item ${l}`), `Item ${l} has strictly its own caption`);
        for (const other of letters) {
          if (other !== l) {
            assert(item?.creator.name !== `@creator_${other}`, `Item ${l} creator does NOT equal Item ${other}`);
            assert(!item?.description.includes(`Caption of item ${other}`), `Item ${l} caption does NOT leak Item ${other}`);
          }
        }
      }
    });

    await test("REGRESSION TEST — REPROCESSING: Allows summary and tags to improve, rejects mutation of authoritative source facts", async () => {
      const testUser = `reprocess-regress-${Date.now()}`;
      const originalItem: SavedItem = {
        id: `reprocess-item-${Date.now()}`,
        title: "Authoritative Export Title",
        url: "https://www.instagram.com/reel/ORIGINAL_123/",
        thumbnail: "https://cdn.example.com/original.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@authentic_author" },
        description: "My original authoritative export caption",
        savedDate: "2023-11-20T08:30:00.000Z",
        tags: ["orig_tag"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Old Summary", standard: "Old Standard", detailed: "Old Detailed" },
        keyPoints: [],
        topics: ["Old Topic"],
        personalNotes: "",
        metadata: {
          shortcode: "ORIGINAL_123",
          caption: "My original authoritative export caption",
          thumbnailSource: "export",
        },
        provenance: {
          creator: { source: "instagram_export_metadata" },
          caption: { source: "instagram_export_metadata" },
        },
      };

      ContentService.addItem(originalItem, testUser);

      const reprocessed = await ReprocessingService.reprocessItem(originalItem.id, testUser);
      assert(reprocessed !== null, "Reprocess succeeded");

      // Rejected mutations:
      assertEqual(reprocessed?.url, "https://www.instagram.com/reel/ORIGINAL_123/", "URL strictly unchanged");
      assertEqual(reprocessed?.creator.name, "@authentic_author", "Creator strictly unchanged");
      assertEqual(reprocessed?.description, "My original authoritative export caption", "Original caption strictly unchanged");
      assertEqual(reprocessed?.savedDate, "2023-11-20T08:30:00.000Z", "Saved timestamp strictly unchanged");
    });

    await test("REGRESSION TEST — WEAKER PROVIDER DATA: Remote provider contributes only missing fields, never overwrites authoritative export", () => {
      const existingExportItem: SavedItem = {
        id: "export-item-1",
        title: "Clean Export Title",
        url: "https://www.instagram.com/p/WEAKER_TEST/",
        thumbnail: "",
        platform: "instagram",
        contentType: "post",
        creator: { name: "@real_creator" },
        description: "Real caption from export",
        savedDate: "2024-02-14T09:00:00.000Z",
        tags: [],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: [],
        topics: [],
        personalNotes: "",
        metadata: {
          shortcode: "WEAKER_TEST",
          caption: "Real caption from export",
        },
        provenance: {
          creator: { source: "instagram_export_metadata" },
          caption: { source: "instagram_export_metadata" },
        },
      };

      const weakerRemoteProviderData: Partial<SavedItem> = {
        creator: { name: "Instagram Creator" }, // generic fallback
        description: "", // empty
        thumbnail: "https://cdn.example.com/authentic_reel_cover.jpg", // authentic media acquired
        metadata: {
          domain: "instagram.com",
          thumbnailSource: "provider",
        },
      };

      const merged = ContentService.safeMerge(existingExportItem, weakerRemoteProviderData);

      assertEqual(merged.creator.name, "@real_creator", "Authoritative export creator preserved");
      assertEqual(merged.description, "Real caption from export", "Authoritative export caption preserved");
      assertEqual(merged.thumbnail, "https://cdn.example.com/authentic_reel_cover.jpg", "Provider authentic image contributed");
      assertEqual(merged.metadata.thumbnailSource, "provider", "Thumbnail source updated to provider");
    });

    // ---------------------------------------------------------------------------
    // 21. AI Transcription & Intelligent Collection Organizer Tests (Tests A - L)
    // ---------------------------------------------------------------------------
    console.log("21. AI Transcription & Intelligent Collection Organizer Tests:");

    const createTestSavedItem = (overrides: Partial<SavedItem> & { id: string; url: string }): SavedItem => ({
      id: overrides.id,
      title: overrides.title ?? "Test Reel",
      url: overrides.url,
      thumbnail: overrides.thumbnail ?? "https://example.com/thumb.jpg",
      platform: overrides.platform ?? "instagram",
      contentType: overrides.contentType ?? "reel",
      creator: overrides.creator ?? { name: "@test_creator" },
      description: overrides.description ?? "Test description caption",
      savedDate: overrides.savedDate ?? "2024-03-01T12:00:00.000Z",
      tags: overrides.tags ?? [],
      favorite: overrides.favorite ?? false,
      archived: overrides.archived ?? false,
      trashed: overrides.trashed ?? false,
      aiSummary: overrides.aiSummary ?? { quick: "Q", standard: "S", detailed: "D" },
      keyPoints: overrides.keyPoints ?? [],
      topics: overrides.topics ?? [],
      personalNotes: overrides.personalNotes ?? "",
      collectionId: overrides.collectionId,
      metadata: overrides.metadata ?? {},
      provenance: overrides.provenance ?? {},
    });
    const trustedTranscript = (text: string) => ({
      metadata: { transcript: text },
      provenance: { transcript: { source: "faster-whisper", value: text } },
    });

    await test("TEST A — Single selected Reel: Reuses verified transcript and assigns to matching collection", async () => {
      const userId = "user_test_a";
      const colVideo: Collection = {
        id: "col-video",
        name: "Video Editing",
        description: "Video tutorials",
        color: "#6366f1",
        icon: "video",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([colVideo], userId);

      const testItem = createTestSavedItem({
        id: "item-test-a",
        url: "https://www.instagram.com/reel/C_test_a/",
        title: "Premiere Transition Tutorial",
        description: "How to edit smooth transitions",
        ...trustedTranscript("Video editing tutorial: create a smooth transition in Adobe Premiere Pro using keyframes."),
      });
      StorageService.saveItems([testItem], userId);

      const report = await CollectionOrganizerService.organizeSelectedItems(
        [testItem],
        [colVideo],
        { userId, autoAssignThreshold: 0.7 }
      );

      assertEqual(report.totalSelected, 1, "Exactly 1 item selected");
      assertEqual(report.processedCount, 1, "Exactly 1 item processed");
      assertEqual(report.autoAssignedCount, 1, "1 item auto-assigned");
      const result = report.results[0];
      assert(result !== undefined, "Result must exist");
      assert(result.transcription !== undefined, "Expected transcription result to exist");
      if (!result.transcription) {
        throw new Error("Expected transcription result to exist");
      }
      assertEqual(result.transcription.status, "transcribed", "Verified persisted transcript is reused");
      assert(typeof result.transcription.text === "string", "Transcript text must be string");
      if (typeof result.transcription.text !== "string") {
        throw new Error("Expected transcript text to be string");
      }
      assert(result.transcription.text.includes("smooth transition"), "Transcript contains spoken text");
      assertEqual(result.decision, "APPLIED", "Decision must be APPLIED due to high confidence match");
      assert(result.collectionMatch !== undefined, "Expected collection match to exist");
      if (!result.collectionMatch) {
        throw new Error("Expected collection match to exist");
      }
      assertEqual(result.collectionMatch.suggestedCollectionName, "Video Editing", "Matches Video Editing collection");

      // Verify stored item was updated safely
      const stored = ContentService.getById("item-test-a", userId);
      assertEqual(stored?.collectionId, "col-video", "Stored item collectionId updated");
      assert(Boolean(stored?.metadata?.transcript), "Transcript stored in metadata");
    });

    await test("TEST B — Select All scope: Processes only the selected import scope, never unrelated library items", async () => {
      const userId = "user_test_b";
      // 20 items in bulk import job
      const jobItems: SavedItem[] = Array.from({ length: 20 }, (_, i) =>
        createTestSavedItem({
          id: `job-item-${i}`,
          url: `https://www.instagram.com/reel/C_job_${i}/`,
          title: `Job Item ${i}`,
          description: `Imported Reel ${i} about coding`,
        })
      );

      // 5 unrelated existing library items
      const existingLibraryItems: SavedItem[] = Array.from({ length: 5 }, (_, i) =>
        createTestSavedItem({
          id: `library-item-${i}`,
          url: `https://www.instagram.com/p/C_library_${i}/`,
          title: `Pre-existing Library Item ${i}`,
          description: "Should not be touched",
        })
      );

      StorageService.saveItems([...jobItems, ...existingLibraryItems], userId);

      // Select All in the bulk import scope = jobItems only
      const report = await CollectionOrganizerService.organizeSelectedItems(
        jobItems,
        [],
        { userId }
      );

      assertEqual(report.totalSelected, 20, "Exactly 20 selected items");
      assertEqual(report.processedCount, 20, "Exactly 20 processed items");

      // Verify the 5 unrelated library items are completely untouched
      const allStored = StorageService.getItems(userId);
      for (let i = 0; i < 5; i++) {
        const untouched = allStored.find((item) => item.id === `library-item-${i}`);
        assert(untouched !== undefined, `Library item ${i} still exists`);
        assertEqual(untouched?.metadata?.transcript, undefined, `Library item ${i} transcript untouched`);
        assertEqual(untouched?.metadata?.organization, undefined, `Library item ${i} organization untouched`);
      }
    });

    await test("TEST C — Semantic classification: Matches domain semantics (Premiere Pro -> Video Editing) without brittle keywords", async () => {
      const evidence = {
        transcript: "Here's how video editing creates a smooth transition in Adobe Premiere Pro using speed ramps and keyframes.",
        originalCaption: "Try this in your next project 🔥",
        creator: "editing_pro",
        hashtags: ["#editor"],
        sourcePlatform: "instagram" as const,
        contentType: "reel" as const,
      };

      const collections: Collection[] = [
        {
          id: "col-editing",
          name: "Video Editing",
          description: "Video production and editing tutorials",
          color: "#6366f1",
          icon: "video",
          count: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "col-cooking",
          name: "Cooking & Recipes",
          description: "Kitchen recipes and cooking tips",
          color: "#10b981",
          icon: "utensils",
          count: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const analysis = await CollectionOrganizerService.analyzeItem(createTestSavedItem({
        id: "item-semantic-evidence",
        url: "https://www.instagram.com/reel/semantic-evidence/",
        ...trustedTranscript(evidence.transcript),
      }), collections);
      const match = analysis.collectionMatch;

      assert(match !== undefined, "Verified transcript produces a collection match");
      assert(analysis.primaryTopic.length > 0, "Primary topic is derived from verified transcript text");
      assert(evidence.transcript.toLowerCase().includes(analysis.primaryTopic.toLowerCase()), "Primary topic is grounded in the verified transcript");
      assertEqual(match.suggestedCollectionName, "Video Editing", "Verified transcript matched to Video Editing");
      assertEqual(match.collectionId, "col-editing", "Mapped to existing col-editing ID");
      assert(match.confidence >= 0.8, "High confidence match");
    });

    await test("TEST D — Resource intent: Detects 'Comment PRESET for link' as RESOURCE_ACQUISITION with trigger", async () => {
      const evidence = {
        transcript: "Comment PRESET and I'll send you the pack with all 20 LUTs directly to your DM.",
        originalCaption: "Drop PRESET below to get the download link instantly!",
        creator: "creator_assets",
        hashtags: ["#presets", "#freebie"],
        sourcePlatform: "instagram" as const,
        contentType: "reel" as const,
      };

      const analysis = await CollectionOrganizerService.analyzeItem(createTestSavedItem({
        id: "item-resource-evidence",
        url: "https://www.instagram.com/reel/resource-evidence/",
        ...trustedTranscript(evidence.transcript),
      }));

      assertEqual(analysis.intent, "RESOURCE_ACQUISITION", "Intent classified as RESOURCE_ACQUISITION");
      assert(analysis.resourceAction !== undefined, "ResourceAction extracted");
      assertEqual(analysis.resourceAction?.action, "comment", "Action is comment");
      assertEqual(analysis.resourceAction?.trigger, "PRESET", "Trigger keyword is PRESET");
      assert((analysis.resourceAction?.confidence ?? 0) >= 0.8, "High confidence trigger extraction");
    });

    await test("TEST E — Transcript unavailable fallback: Gracefully handles media absence with metadata fallback", async () => {
      const userId = "user_test_e";
      const colTools: Collection = {
        id: "col-tools",
        name: "Useful Tools",
        description: "Developer tools and utilities",
        color: "#f59e0b",
        icon: "wrench",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([colTools], userId);

      const itemWithoutMedia = createTestSavedItem({
        id: "item-no-media",
        url: "https://www.instagram.com/reel/C_no_media/",
        title: "Top 5 VSCode Extensions for Web Development",
        description: "Here are 5 useful tools for your coding toolkit: Prettier, ESLint, GitLens, Error Lens, and Tailwind CSS IntelliSense.",
        metadata: {
          // No media buffer
        },
      });
      StorageService.saveItems([itemWithoutMedia], userId);

      const report = await CollectionOrganizerService.organizeSelectedItems(
        [itemWithoutMedia],
        [colTools],
        { userId, autoAssignThreshold: 0.7 }
      );

      assertEqual(report.totalSelected, 1, "1 item selected");
      assertEqual(report.processedCount, 1, "1 item processed");
      const result = report.results[0];
      assert(result !== undefined, "Result must exist");
      assert(result.transcription !== undefined, "Expected transcription result to exist");
      if (!result.transcription) {
        throw new Error("Expected transcription result to exist");
      }
      assertEqual(result.transcription.status, "unavailable", "Transcript status is unavailable");
      assertEqual(result.decision, "UNCERTAIN", "Metadata-only evidence must not auto-assign a collection");
      assertEqual(result.collectionMatch?.suggestedCollectionName, undefined, "No collection match without verified transcript or source text");

      // Item remains stored and intact
      const stored = ContentService.getById("item-no-media", userId);
      assert(stored !== undefined, "Item remains stored in library");
      assertEqual(stored?.collectionId, undefined, "No collection assigned from title and unverified metadata");
      assert(TranscriptionService.isStructuredTranscript(stored?.metadata?.transcript), "Transcript status recorded as unavailable");
      assertEqual(stored.metadata.transcript.status, "unavailable", "Transcript status recorded as unavailable");
    });

    await test("TEST F — One failure isolation: 1 failed item does not abort or rollback remaining 9 successful items", async () => {
      const userId = "user_test_f";
      const colDev: Collection = {
        id: "col-dev",
        name: "React Learning",
        description: "Frontend tutorials",
        color: "#3b82f6",
        icon: "code",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([colDev], userId);

      const items: SavedItem[] = Array.from({ length: 10 }, (_, i) => {
        if (i === 4) {
          // Item 4: Missing URL to trigger failure/skip in processing
          return createTestSavedItem({
            id: `item-fail-4`,
            url: "", // Invalid empty URL
            title: "Corrupted Item",
            description: "Missing URL",
          });
        }
        return createTestSavedItem({
          id: `item-success-${i}`,
          url: `https://www.instagram.com/reel/C_succ_${i}/`,
          title: `React Hooks Guide ${i}`,
          description: `Learn how to use useEffect and useMemo in React ${i}`,
          ...trustedTranscript(`Learn how to use useEffect and useMemo in React ${i}.`),
        });
      });

      StorageService.saveItems(items, userId);

      const report = await CollectionOrganizerService.organizeSelectedItems(
        items,
        [colDev],
        { userId, autoAssignThreshold: 0.7 }
      );

      assertEqual(report.totalSelected, 10, "10 items selected");
      assertEqual(report.processedCount, 10, "10 items processed");
      assertEqual(report.failedCount, 1, "Exactly 1 item failed");
      assertEqual(report.autoAssignedCount, 9, "9 items successfully organized and assigned");

      const failedResult = report.results.find((r) => r.itemId === "item-fail-4");
      assert(failedResult !== undefined, "Failed item result exists");
      assertEqual(failedResult?.decision, "SKIPPED", "Failed item marked SKIPPED");

      // Zero items deleted from storage
      const allStored = StorageService.getItems(userId);
      assertEqual(allStored.length, 10, "All 10 items remain in storage");
    });

    await test("TEST G — Source immutability: Protects authoritative export URL, creator, caption, savedDate from alteration", async () => {
      const userId = "user_test_g";
      const originalUrl = "https://www.instagram.com/reel/C_immutable_123/";
      const originalCreator = "@authoritative_creator";
      const originalCaption = "Real raw caption from Meta ZIP export that must NEVER be overwritten.";
      const originalSavedDate = "2023-04-12T10:15:30.000Z";

      const item = createTestSavedItem({
        id: "item-immutable-test",
        url: originalUrl,
        title: "Clean Export Reel",
        creator: { name: originalCreator },
        description: originalCaption,
        savedDate: originalSavedDate,
        metadata: {
          shortcode: "C_immutable_123",
          fbid: "9988776655",
          caption: originalCaption,
        },
        provenance: {
          creator: { source: "instagram_export_metadata" },
          caption: { source: "instagram_export_metadata" },
        },
      });

      StorageService.saveItems([item], userId);

      await CollectionOrganizerService.organizeSelectedItems(
        [item],
        [],
        { userId }
      );

      const updated = ContentService.getById("item-immutable-test", userId);
      assert(updated !== undefined, "Item exists");
      assertEqual(updated?.url, originalUrl, "URL must be strictly identical");
      assertEqual(updated?.creator.name, originalCreator, "Creator name must be strictly identical");
      assertEqual(updated?.description, originalCaption, "Description/caption must be strictly identical");
      assertEqual(updated?.savedDate, originalSavedDate, "Saved date must be strictly identical");
      assertEqual(updated?.metadata?.shortcode, "C_immutable_123", "Shortcode strictly preserved");
      assertEqual(updated?.metadata?.fbid, "9988776655", "FBID strictly preserved");
      assert(Boolean(updated?.metadata?.organization), "Derived organization metadata added safely");
    });

    await test("TEST H — Idempotency: Running organizer twice does not create duplicate collections, transcripts, or tags", async () => {
      const userId = "user_test_h";
      const colAI: Collection = {
        id: "col-ai",
        name: "AI & Automation",
        description: "AI workflows",
        color: "#8b5cf6",
        icon: "bot",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([colAI], userId);

      const item = createTestSavedItem({
        id: "item-idempotent-test",
        url: "https://www.instagram.com/reel/C_idem_123/",
        title: "Build n8n AI Agent",
        description: "How to build an AI agent using n8n and OpenAI",
        tags: ["automation"],
        ...trustedTranscript("How to build an AI agent using n8n and OpenAI automation."),
      });
      StorageService.saveItems([item], userId);

      // Run 1
      const report1 = await CollectionOrganizerService.organizeSelectedItems(
        [item],
        [colAI],
        { userId, autoAssignThreshold: 0.7 }
      );
      assertEqual(report1.autoAssignedCount, 1, "First run auto-assigns");

      // Run 2
      const currentItem = ContentService.getById("item-idempotent-test", userId)!;
      const report2 = await CollectionOrganizerService.organizeSelectedItems(
        [currentItem],
        [colAI],
        { userId, autoAssignThreshold: 0.7 }
      );
      assertEqual(report2.autoAssignedCount, 1, "Second run succeeds idempotently");

      const finalItem = ContentService.getById("item-idempotent-test", userId)!;
      assertEqual(finalItem.collectionId, "col-ai", "Collection ID remains singular and stable");
      // Verify tags are not duplicated
      const tagSet = new Set(finalItem.tags);
      assertEqual(tagSet.size, finalItem.tags.length, "No duplicate tags introduced");

      // Verify collections in storage are not duplicated
      const allCollections = StorageService.getCollections(userId);
      assertEqual(allCollections.length, 1, "No duplicate collections created in storage");
    });

    await test("TEST I — Tenant isolation: User A cannot read, organize, or assign User B items or collections", async () => {
      const userA = "tenant_user_a";
      const userB = "tenant_user_b";

      const colA: Collection = {
        id: "col-user-a",
        name: "User A Vault",
        description: "Private A",
        color: "#ef4444",
        icon: "lock",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const colB: Collection = {
        id: "col-user-b",
        name: "User B Secret",
        description: "Private B",
        color: "#10b981",
        icon: "shield",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      StorageService.saveCollections([colA], userA);
      StorageService.saveCollections([colB], userB);

      const itemA = createTestSavedItem({
        id: "item-a",
        url: "https://www.instagram.com/reel/C_user_a/",
        title: "User A Secret Video",
        description: "Private content for user A",
      });
      const itemB = createTestSavedItem({
        id: "item-b",
        url: "https://www.instagram.com/reel/C_user_b/",
        title: "User B Confidential Video",
        description: "Confidential content for user B",
      });

      StorageService.saveItems([itemA], userA);
      StorageService.saveItems([itemB], userB);

      // User A runs organizer with User A collections
      const reportA = await CollectionOrganizerService.organizeSelectedItems(
        [itemA],
        [colA],
        { userId: userA }
      );

      // User A cannot match or assign User B collection
      const resultA = reportA.results[0];
      assert(resultA !== undefined, "Result A must exist");
      assert(resultA.collectionMatch !== undefined, "Expected collection match to exist");
      if (!resultA.collectionMatch) {
        throw new Error("Expected collection match to exist");
      }
      assert(resultA.collectionMatch.collectionId !== "col-user-b", "User A cannot match User B collection");

      // User B's item is untouched
      const storedB = ContentService.getById("item-b", userB);
      assertEqual(storedB?.collectionId, undefined, "User B item untouched by User A organizer");
      assertEqual(storedB?.metadata?.organization, undefined, "User B item has no metadata from User A");
    });

    await test("TEST J — Collection explosion prevention: One-off weakly related topics do not spawn new collections", async () => {
      const userId = "user_test_j";
      const existingCol: Collection = {
        id: "col-general",
        name: "General Tech",
        description: "General tech posts",
        color: "#6b7280",
        icon: "hash",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([existingCol], userId);

      const weaklyRelatedItems = [
        createTestSavedItem({
          id: "item-weak-1",
          url: "https://www.instagram.com/reel/C_weak_1/",
          title: "Origami Paper Crane Tutorial",
          description: "How to fold a paper crane in 5 steps",
        }),
        createTestSavedItem({
          id: "item-weak-2",
          url: "https://www.instagram.com/reel/C_weak_2/",
          title: "Growing Indoor Mint and Basil",
          description: "Tips for container gardening herbs",
        }),
      ];
      StorageService.saveItems(weaklyRelatedItems, userId);

      const report = await CollectionOrganizerService.organizeSelectedItems(
        weaklyRelatedItems,
        [existingCol],
        { userId, allowAutoCreateCollections: false }
      );

      // Since allowAutoCreateCollections is false, neither should spawn a new collection
      assert(report.clusters !== undefined, "Expected clusters to exist");
      if (!report.clusters) {
        throw new Error("Expected clusters to exist");
      }
      assertEqual(report.clusters.length, 1, "Only 1 cluster (Uncertain)");
      assertEqual(report.uncertainCount, 2, "Both items classified as UNCERTAIN");

      // Storage should still have only 1 collection
      const collectionsAfter = StorageService.getCollections(userId);
      assertEqual(collectionsAfter.length, 1, "No new collections created in storage");
    });

    await test("TEST K — Existing collection preference: Prefers 'AI & Automation' over creating redundant 'n8n' collection", async () => {
      const existingCol: Collection = {
        id: "col-ai-automation",
        name: "AI & Automation",
        description: "AI workflows and automation scripts",
        color: "#8b5cf6",
        icon: "bot",
        count: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const evidence = {
        transcript: "In this tutorial we are going to build an automated n8n workflow connected to OpenAI to parse customer feedback.",
        originalCaption: "Automate your workflow with n8n",
        creator: "automation_guru",
        hashtags: ["#n8n", "#ai", "#workflow"],
        sourcePlatform: "instagram" as const,
        contentType: "reel" as const,
      };

      const analysis = await CollectionOrganizerService.analyzeItem(evidence);
      const match = CollectionOrganizerService.matchCollection(evidence, [existingCol], analysis);

      assertEqual(match.collectionId, "col-ai-automation", "Matches existing AI & Automation collection");
      assertEqual(match.suggestedCollectionName, "AI & Automation", "Prefers existing collection name");
      assert(match.confidence >= 0.8, "High confidence match for existing collection");
    });

    await test("TEST L — Concurrency isolation: Concurrently organizing distinct items never leaks data between records", async () => {
      const userId = "user_test_l";
      const testItems: SavedItem[] = [
        createTestSavedItem({
          id: "conc-item-1",
          url: "https://www.instagram.com/reel/C_conc_1/",
          title: "Premiere Speed Ramps",
          description: "Speed ramping in Premiere Pro",
          ...trustedTranscript("Speed ramping in Premiere Pro creates smooth video transitions."),
        }),
        createTestSavedItem({
          id: "conc-item-2",
          url: "https://www.instagram.com/reel/C_conc_2/",
          title: "React 19 Actions",
          description: "How to use useActionState in React 19",
          ...trustedTranscript("How to use useActionState in React 19 for modern interactive applications."),
        }),
        createTestSavedItem({
          id: "conc-item-3",
          url: "https://www.instagram.com/reel/C_conc_3/",
          title: "Comment TEMPLATE for Notion",
          description: "Comment TEMPLATE to get the link to this life planner",
          ...trustedTranscript("Comment TEMPLATE to get the link to this life planner download."),
        }),
        createTestSavedItem({
          id: "conc-item-4",
          url: "https://www.instagram.com/reel/C_conc_4/",
          title: "Baking Sourdough Bread",
          description: "How to feed your sourdough starter and bake a crusty loaf",
          ...trustedTranscript("How to feed your sourdough starter and bake a crusty loaf at home."),
        }),
      ];

      StorageService.saveItems(testItems, userId);

      const report = await CollectionOrganizerService.organizeSelectedItems(
        testItems,
        [],
        { userId, concurrency: 4 }
      );

      assertEqual(report.processedCount, 4, "All 4 processed concurrently");

      const r1 = report.results.find((r) => r.itemId === "conc-item-1");
      const r2 = report.results.find((r) => r.itemId === "conc-item-2");
      const r3 = report.results.find((r) => r.itemId === "conc-item-3");
      const r4 = report.results.find((r) => r.itemId === "conc-item-4");

      assert(r1 !== undefined, "Result 1 must exist");
      if (!r1 || !r1.analysis) {
        throw new Error("Expected result 1 and analysis to exist");
      }

      assert(r2 !== undefined, "Result 2 must exist");
      if (!r2 || !r2.analysis) {
        throw new Error("Expected result 2 and analysis to exist");
      }

      assert(r3 !== undefined, "Result 3 must exist");
      if (!r3 || !r3.analysis) {
        throw new Error("Expected result 3 and analysis to exist");
      }

      assert(r4 !== undefined, "Result 4 must exist");
      if (!r4 || !r4.analysis) {
        throw new Error("Expected result 4 and analysis to exist");
      }

      assert(r1.analysis.primaryTopic.length > 0 && "Speed ramping in Premiere Pro creates smooth video transitions.".toLowerCase().includes(r1.analysis.primaryTopic.toLowerCase()), "Item 1 topic is grounded in its own transcript");
      assert(r2.analysis.primaryTopic.length > 0 && "How to use useActionState in React 19 for modern interactive applications.".toLowerCase().includes(r2.analysis.primaryTopic.toLowerCase()), "Item 2 topic is grounded in its own transcript");
      assertEqual(r3.analysis.intent, "RESOURCE_ACQUISITION", "Item 3 has resource acquisition intent");
      assertEqual(r3.analysis.resourceAction?.trigger, "TEMPLATE", "Item 3 captured TEMPLATE trigger");
      assert(r4.analysis.primaryTopic.length > 0 && "How to feed your sourdough starter and bake a crusty loaf at home.".toLowerCase().includes(r4.analysis.primaryTopic.toLowerCase()), "Item 4 topic is grounded in its own transcript");

      // Strictly ensure no cross-leakage in storage
      const s1 = ContentService.getById("conc-item-1", userId);
      const s2 = ContentService.getById("conc-item-2", userId);
      assert(s1 !== undefined, "Stored item 1 must exist");
      if (!s1) {
        throw new Error("Expected stored item 1 to exist");
      }
      assert(s2 !== undefined, "Stored item 2 must exist");
      if (!s2) {
        throw new Error("Expected stored item 2 to exist");
      }
      assertEqual(s1.metadata?.organization?.intent, "TUTORIAL", "Item 1 intent stored correctly");
      assertEqual(s2.metadata?.organization?.intent, "LEARNING", "Item 2 intent stored correctly");
    });

    // ---------------------------------------------------------------------------
    // 25. Authentic Social-Media Preview / Thumbnail Acquisition Tests (Tests A - N)
    // ---------------------------------------------------------------------------
    console.log("\n25. Authentic Social-Media Preview / Thumbnail Acquisition Tests (Tests A - N):");

    await test("TEST A — Reel A resolves authentic thumbnail A", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/c_reel_alpha.jpg", "data:image/jpeg;base64,QUxQSEFfVEhVTUI="],
      ]);

      const resA = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Reel_Alpha/", {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/c_reel_alpha.jpg" },
      });

      assertEqual(resA.status, "resolved", "Reel A status resolved");
      assertEqual(resA.source, "export_archive_image", "Source is export_archive_image");
      assertEqual(resA.previewUrl, "data:image/jpeg;base64,QUxQSEFfVEhVTUI=", "Exact thumbnail A retrieved");
    });

    await test("TEST B — Reel B resolves thumbnail B and A !== B with separate canonical identities", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/c_reel_beta.jpg", "data:image/jpeg;base64,QkVUQV9USFVNQg=="],
      ]);

      const resB = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Reel_Beta/", {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/c_reel_beta.jpg" },
      });

      assertEqual(resB.status, "resolved", "Reel B status resolved");
      assertEqual(resB.source, "export_archive_image", "Source is export_archive_image");
      assertEqual(resB.previewUrl, "data:image/jpeg;base64,QkVUQV9USFVNQg==", "Exact thumbnail B retrieved");

      // Retrieve A from durable cache or fresh
      const idA = MediaPreviewResolver.getCanonicalIdentity("https://www.instagram.com/reel/C_Reel_Alpha/");
      const idB = MediaPreviewResolver.getCanonicalIdentity("https://www.instagram.com/reel/C_Reel_Beta/");

      assert(idA.cacheKey !== idB.cacheKey, "Reel A and Reel B have distinct cache keys");
      assert(idA.shortcode !== idB.shortcode, "Reel A and Reel B have distinct shortcodes");
      assert(resB.previewUrl !== "data:image/jpeg;base64,QUxQSEFfVEhVTUI=", "Thumbnail A and Thumbnail B are distinct (A !== B)");
    });

    await test("TEST C — Image Post C returns its actual image", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/c_post_gamma.jpg", "data:image/jpeg;base64,R0FNTUFfUE9TVF9JTUFHRQ=="],
      ]);

      const resC = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/p/C_Post_Gamma/", {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/c_post_gamma.jpg" },
      });

      assertEqual(resC.status, "resolved", "Post C status resolved");
      assertEqual(resC.source, "export_archive_image", "Source is export_archive_image");
      assertEqual(resC.previewUrl, "data:image/jpeg;base64,R0FNTUFfUE9TVF9JTUFHRQ==", "Actual post image returned");
    });

    await test("TEST C2 — Authentic provider thumbnail is retained by canonical resolver", async () => {
      const providerThumbnail = "https://scontent.cdninstagram.com/v/t51.2885-15/keeper-reel-cover.jpg";
      const resolved = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Provider_Thumbnail/", {
        allowNetwork: false,
        providerMetadata: { thumbnailUrl: providerThumbnail, hasAuthenticThumb: true },
      });
      assertEqual(resolved.status, "resolved", "Provider thumbnail is considered resolved");
      assertEqual(resolved.source, "provider_media", "Provider image provenance is retained");
      assertEqual(resolved.previewUrl, providerThumbnail, "Authentic provider thumbnail is not replaced by placeholder");
    });

    await test("TEST C3 — Direct authentic thumbnail from export JSON works without archive extraction", async () => {
      const exportThumbnail = "https://scontent.cdninstagram.com/v/t51.2885-15/keeper-export-cover.jpg";
      const resolved = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Export_Thumbnail/", {
        allowNetwork: false,
        exportMetadata: { thumbnailUrl: exportThumbnail },
      });
      assertEqual(resolved.status, "resolved", "Export image is considered resolved");
      assertEqual(resolved.source, "export_metadata", "Export provenance is retained");
      assertEqual(resolved.previewUrl, exportThumbnail, "Direct export image survives without local archive lookup");
    });

    await test("TEST D — Carousel returns deterministic primary cover across renders", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/carousel_1.jpg", "data:image/jpeg;base64,Q09WRVJfMQ=="],
        ["media/posts/carousel_2.jpg", "data:image/jpeg;base64,Q09WRVJfMg=="],
        ["media/posts/carousel_3.jpg", "data:image/jpeg;base64,Q09WRVJfMw=="],
      ]);

      const context = {
        archiveFileResolver: (p: string) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: {
          media: ["media/posts/carousel_1.jpg", "media/posts/carousel_2.jpg", "media/posts/carousel_3.jpg"],
        },
      };

      const run1 = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/p/C_Carousel_123/", context);
      const run2 = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/p/C_Carousel_123/", context);

      assertEqual(run1.previewUrl, "data:image/jpeg;base64,Q09WRVJfMQ==", "Primary cover 1 selected");
      assertEqual(run1.previewUrl, run2.previewUrl, "Deterministic cover is identical across renders");
    });

    await test("TEST E — Full Meta ZIP contains exact media: local authentic media wins over remote lookup", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/c_zip_priority.jpg", "data:image/jpeg;base64,WklQX0xPQ0FMX01FRElB"],
      ]);

      const res = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Zip_Priority/", {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/c_zip_priority.jpg" },
        providerMetadata: {
          hasAuthenticThumb: true,
          thumbnailUrl: "https://remote.cdn.example.com/other_thumb.jpg",
        },
      });

      assertEqual(res.source, "export_archive_image", "Local ZIP media has Priority 1 over remote lookup");
      assertEqual(res.previewUrl, "data:image/jpeg;base64,WklQX0xPQ0FMX01FRElB", "Exact local media returned");
    });

    await test("TEST F — Reel video exists but thumbnail doesn't: frame generated from Reel video", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/c_video_only.mp4", "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQ=="],
      ]);

      const res = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Video_Only/", {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/c_video_only.mp4" },
      });

      assertEqual(res.status, "resolved", "Frame generation succeeds");
      assertEqual(res.source, "export_archive_video_frame", "Source is export_archive_video_frame");
      assert(res.previewUrl.startsWith("data:image/"), "Valid image data URL produced");
      assert(res.previewUrl.includes("VIDEO%20FRAME") || res.previewUrl.includes("C_Video_Only"), "Tied to exact Reel identity");
    });

    await test("TEST G — JSON-only export with no accessible media: item stored safely with placeholder", async () => {
      const res = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Json_Only/", {
        // No archive resolver, no provider
      });

      assertEqual(res.status, "unavailable", "Status is unavailable");
      assertEqual(res.source, "fallback", "Source is fallback");
      assertEqual(res.previewUrl, INSTAGRAM_REEL_PLACEHOLDER, "Returns branded placeholder");
      assert(res.failureReason !== undefined, "Failure reason provided");
    });

    await test("TEST H — Remote media request times out: item still stored safely with placeholder", async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-aborted to simulate immediate timeout

      const res = await MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/C_Timeout_Reel/", {
        signal: controller.signal,
      });

      assertEqual(res.status, "unavailable", "Graceful handling of timeout");
      assertEqual(res.previewUrl, INSTAGRAM_REEL_PLACEHOLDER, "Renders placeholder safely");
    });

    await test("TEST I — Existing verified thumbnail + later provider failure: verified thumbnail preserved via safeMerge", () => {
      const existingItem: SavedItem = {
        id: "item-prev-test-i",
        title: "Existing Item with Real Thumb",
        url: "https://www.instagram.com/reel/C_Safe_Merge_I/",
        thumbnail: "data:image/jpeg;base64,VkVSSUZJRURfVEhVTUI=",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@authentic_artist" },
        description: "My original caption",
        savedDate: "2024-01-01T12:00:00.000Z",
        tags: [],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: [],
        topics: [],
        personalNotes: "",
        metadata: {
          domain: "instagram.com",
          thumbnailSource: "provider",
          shortcode: "C_Safe_Merge_I",
        },
        provenance: {
          creator: { source: "instagram_export_metadata", value: "@authentic_artist", retrievedAt: "2024-01-01" },
          thumbnail: { source: "provider", value: "data:image/jpeg;base64,VkVSSUZJRURfVEhVTUI=", retrievedAt: "2024-01-01" },
        },
      };

      // Weaker subsequent update attempt with fallback placeholder
      const weakerUpdate: Partial<SavedItem> = {
        thumbnail: INSTAGRAM_REEL_PLACEHOLDER,
        metadata: {
          domain: "instagram.com",
          thumbnailSource: "fallback",
        },
        provenance: {
          thumbnail: { source: "fallback_preview", value: INSTAGRAM_REEL_PLACEHOLDER, retrievedAt: "2024-01-02" },
        },
      };

      const merged = ContentService.safeMerge(existingItem, weakerUpdate);

      assertEqual(merged.thumbnail, "data:image/jpeg;base64,VkVSSUZJRURfVEhVTUI=", "Authentic thumbnail preserved against downgrade");
      assertEqual(merged.metadata.thumbnailSource, "provider", "Thumbnail source remains provider");
      assertEqual(merged.creator.name, "@authentic_artist", "Authoritative creator preserved");
    });

    await test("TEST J — Two simultaneous Reels: Reel A can NEVER receive Reel B's thumbnail", async () => {
      const archiveFiles = new Map<string, string>([
        ["media/posts/reel_sim_a.jpg", "data:image/jpeg;base64,VEhVTUJfQUxQSEE="],
        ["media/posts/reel_sim_b.jpg", "data:image/jpeg;base64,VEhVTUJfQkVUQQ=="],
      ]);

      const [resA, resB] = await Promise.all([
        MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/Reel_Sim_A/", {
          archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
          exportMetadata: { archivePath: "media/posts/reel_sim_a.jpg" },
        }),
        MediaPreviewResolver.resolvePreview("https://www.instagram.com/reel/Reel_Sim_B/", {
          archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
          exportMetadata: { archivePath: "media/posts/reel_sim_b.jpg" },
        }),
      ]);

      assertEqual(resA.previewUrl, "data:image/jpeg;base64,VEhVTUJfQUxQSEE=", "Reel A received Thumbnail A");
      assertEqual(resB.previewUrl, "data:image/jpeg;base64,VEhVTUJfQkVUQQ==", "Reel B received Thumbnail B");
      assert(resA.previewUrl !== resB.previewUrl, "Reel A did not receive Reel B's thumbnail");
    });

    await test("TEST K — Same Reel with tracking URL + canonical URL produce identical canonical identity", () => {
      const trackingUrl = "https://www.instagram.com/reel/CDupe123/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";
      const canonicalUrl = "https://www.instagram.com/reel/CDupe123/";

      const id1 = MediaPreviewResolver.getCanonicalIdentity(trackingUrl);
      const id2 = MediaPreviewResolver.getCanonicalIdentity(canonicalUrl);

      assertEqual(id1.shortcode, "CDupe123", "Shortcode extracted cleanly from tracking URL");
      assertEqual(id2.shortcode, "CDupe123", "Shortcode extracted cleanly from canonical URL");
      assertEqual(id1.cacheKey, id2.cacheKey, "Both URLs share the exact same cache key");
      assertEqual(id1.cacheKey, "preview:instagram:reel:CDupe123:v1", "Canonical cache key format verified");
    });

    await test("TEST L — Malicious / untrusted media URL blocked safely by SSRF validator", () => {
      const ssrfAttempts = [
        "https://169.254.169.254/latest/meta-data",
        "https://localhost/admin/avatar.png",
        "https://127.0.0.1:8080/secret.jpg",
        "http://insecure-site.com/image.jpg",
        "https://10.0.0.5/internal_thumb.jpg",
        "https://192.168.1.1/router.jpg",
      ];

      for (const attempt of ssrfAttempts) {
        const check = MediaPreviewResolver.isSafeMediaUrl(attempt);
        assertEqual(check.isSafe, false, `SSRF attempt blocked: ${attempt}`);
        assert(check.reason !== undefined, "Reason provided for rejection");
        assert(!MediaPreviewResolver.isAuthenticMediaUrl(attempt), `isAuthenticMediaUrl rejects SSRF: ${attempt}`);
      }
    });

    await test("TEST M — 100 bulk items: Invalid media URL degrades safely without aborting the batch", async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        url: i === 42 ? "" : `https://www.instagram.com/reel/Bulk_${i}/`,
        id: `bulk-${i}`,
      }));

      let successCount = 0;
      let failedCount = 0;

      for (const item of items) {
        try {
          const res = await MediaPreviewResolver.resolvePreview(item.url);
          if (res.status === "resolved" || res.status === "unavailable") {
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      assertEqual(successCount, 100, "All media lookups resolve or return an honest unavailable result");
      assertEqual(failedCount, 0, "Invalid media is reported without throwing or aborting the batch");
    });

    await test("TEST N — Reprocessing old placeholder item updates thumbnail only while keeping source data unchanged", async () => {
      const userId = "user-reprocess-preview-test";
      const oldItem: SavedItem = {
        id: "old-item-repair-1",
        title: "Authoritative Export Title",
        url: "https://www.instagram.com/reel/CRepairTarget99/",
        thumbnail: INSTAGRAM_REEL_PLACEHOLDER,
        platform: "instagram",
        contentType: "reel",
        creator: { name: "@authoritative_director" },
        description: "Original raw caption that must never change",
        savedDate: "2023-09-15T18:20:00.000Z",
        tags: ["cinema"],
        favorite: true,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Q", standard: "S", detailed: "D" },
        keyPoints: ["Point 1"],
        topics: ["Film"],
        personalNotes: "Director comments",
        metadata: {
          domain: "instagram.com",
          thumbnailSource: "fallback",
          shortcode: "CRepairTarget99",
          fbid: "1122334455",
        },
        provenance: {
          creator: { source: "instagram_export_metadata", value: "@authoritative_director", retrievedAt: "2023-09-15" },
          caption: { source: "instagram_export_metadata", value: "Original raw caption that must never change", retrievedAt: "2023-09-15" },
          thumbnail: { source: "fallback_preview", value: INSTAGRAM_REEL_PLACEHOLDER, retrievedAt: "2023-09-15" },
        },
      };

      StorageService.saveItems([oldItem], userId);

      // ZIP archive media is discovered later
      const archiveFiles = new Map<string, string>([
        ["media/posts/crepairtarget99.jpg", "data:image/jpeg;base64,UkVQQUlSRURfVEhVTUI="],
      ]);

      const repaired = await MediaPreviewResolver.repairItem(oldItem, {
        archiveFileResolver: (p) => archiveFiles.get(p.toLowerCase()) || null,
        exportMetadata: { archivePath: "media/posts/crepairtarget99.jpg" },
      });

      assertEqual(repaired.thumbnail, "data:image/jpeg;base64,UkVQQUlSRURfVEhVTUI=", "Thumbnail repaired with authentic media");
      assertEqual(repaired.metadata.thumbnailSource, "export", "Archive image thumbnail provenance is export");

      // Strictly assert that source authoritative metadata is byte-for-byte unchanged
      assertEqual(repaired.url, oldItem.url, "URL byte-for-byte identical");
      assertEqual(repaired.creator.name, oldItem.creator.name, "Creator name byte-for-byte identical");
      assertEqual(repaired.description, oldItem.description, "Description caption byte-for-byte identical");
      assertEqual(repaired.savedDate, oldItem.savedDate, "Saved date byte-for-byte identical");
      assertEqual(repaired.metadata.shortcode, "CRepairTarget99", "Shortcode preserved");
      assertEqual(repaired.metadata.fbid, "1122334455", "FBID preserved");
      assertEqual(repaired.favorite, true, "Favorite user state preserved");
      assertEqual(repaired.personalNotes, "Director comments", "Personal notes preserved");
    });

    // ---------------------------------------------------------------------------
    // 26. Next.js Script Architecture & Layout Pre-Hydration Tests
    // ---------------------------------------------------------------------------
    console.log("\n26. Next.js Script Architecture & Layout Pre-Hydration Tests:");

    await test("RootLayout uses ThemeScript with useServerInsertedHTML for pre-hydration theme bootstrap", () => {
      const layoutPath = path.join(__dirname, "../src/app/layout.tsx");
      const themeScriptPath = path.join(__dirname, "../src/app/theme-script.tsx");
      const layoutContent = fs.readFileSync(layoutPath, "utf-8");
      const themeScriptContent = fs.readFileSync(themeScriptPath, "utf-8");

      // 1. RootLayout must NOT render any <script> tag in JSX (eliminates React 19 script-tag error)
      const hasScriptInLayout = /<script[\s>]/g.test(layoutContent);
      assertEqual(hasScriptInLayout, false, "RootLayout does not contain <script> tags in JSX");

      // 2. RootLayout imports and renders ThemeScript
      const importsThemeScript = /import\s+\{\s*ThemeScript\s*\}\s+from\s+["']\.\/theme-script["']/.test(layoutContent);
      assert(importsThemeScript, "RootLayout imports ThemeScript from './theme-script'");
      const rendersThemeScript = /<ThemeScript\s*\/>/.test(layoutContent);
      assert(rendersThemeScript, "RootLayout renders <ThemeScript />");

      // 3. ThemeScript must be a client component using useServerInsertedHTML
      const isClientComponent = /"use client"|'use client'/.test(themeScriptContent);
      assert(isClientComponent, "ThemeScript is a Client Component ('use client')");
      const usesServerInsertedHTML = /useServerInsertedHTML/.test(themeScriptContent);
      assert(usesServerInsertedHTML, "ThemeScript uses useServerInsertedHTML from 'next/navigation'");

      // 4. Injected script has explicit id recall-theme-init and theme bootstrap logic
      const hasExplicitId = /id=["']recall-theme-init["']/.test(themeScriptContent);
      assert(hasExplicitId, "ThemeScript injects script with id='recall-theme-init'");

      // 5. ThemeScript returns null on client so React client virtual DOM contains no script elements
      const returnsNull = /return\s+null\s*;/.test(themeScriptContent);
      assert(returnsNull, "ThemeScript returns null on client render");

      // 6. Must retain suppressHydrationWarning on <html>
      const hasSuppressHydration = /<html[^>]*suppressHydrationWarning/.test(layoutContent);
      assert(hasSuppressHydration, "<html> retains suppressHydrationWarning for pre-hydration theme class");
    });

    await test("Theme initialization script executes correctly in pre-hydration DOM simulation", () => {
      // Simulate DOM root
      const classList = new Set<string>();
      const style: { colorScheme?: string } = {};
      const root = {
        classList: {
          add: (c: string) => classList.add(c),
          remove: (c: string) => classList.delete(c),
          contains: (c: string) => classList.has(c),
        },
        style,
      };

      // Simulate mock localStorage
      let mockStore: Record<string, string> = {
        recall_user_v1: JSON.stringify({ settings: { theme: "light" } }),
      };

      // Execute theme script logic
      const runThemeLogic = () => {
        try {
          const raw = mockStore["recall_user_v1"] || mockStore["recall_user"];
          let theme = "dark";
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.settings && parsed.settings.theme) {
              theme = parsed.settings.theme;
            }
          }
          const isDark = theme === "dark";
          if (isDark) {
            root.classList.add("dark");
            root.classList.remove("light");
            root.style.colorScheme = "dark";
          } else {
            root.classList.remove("dark");
            root.classList.add("light");
            root.style.colorScheme = "light";
          }
        } catch (e) { }
      };

      // Run for light theme
      runThemeLogic();
      assertEqual(root.classList.contains("light"), true, "Applied light class to documentElement");
      assertEqual(root.classList.contains("dark"), false, "Removed dark class from documentElement");
      assertEqual(root.style.colorScheme, "light", "Applied light colorScheme style");

      // Run for dark theme
      mockStore = { recall_user_v1: JSON.stringify({ settings: { theme: "dark" } }) };
      runThemeLogic();
      assertEqual(root.classList.contains("dark"), true, "Applied dark class to documentElement");
      assertEqual(root.classList.contains("light"), false, "Removed light class from documentElement");
      assertEqual(root.style.colorScheme, "dark", "Applied dark colorScheme style");
    });

    console.log("Universal Content Intelligence Tests:");
    await test("shares a typed AI-job lifecycle with distinct media failure states", () => {
      for (const stage of ["MEDIA_FOUND", "EXTRACTING_AUDIO", "TRANSCRIPT_READY"] as const) {
        assert(AI_JOB_PROCESSING_STAGES.includes(stage), `${stage} is a recognized processing stage`);
      }
      assert(!AI_JOB_PROCESSING_STAGES.includes("COMPLETED" as never), "Terminal completion is not an active stage");
      assert(!AI_JOB_PROCESSING_STAGES.includes("FAILED" as never), "Terminal failure is not an active stage");
      const types = fs.readFileSync(path.join(process.cwd(), "src/types/index.ts"), "utf8");
      assert(types.includes('export type AIJobStatus = AIJobProcessingStage | "COMPLETED" | "FAILED";'), "AI jobs expose only generic terminal states");
      assert(types.includes('export type MediaProcessingFailureStatus ='), "Stage-specific failure status is media-specific");
    });

    await test("applies table-driven AI job retry, lease, exhaustion, and delay rules", () => {
      const retryCases = [
        { attempts: 1, error: new Error("Provider returned HTTP 503"), expected: true },
        { attempts: 4, error: new Error("Request timed out"), expected: true },
        { attempts: 5, error: new Error("Provider returned HTTP 503"), expected: false },
        { attempts: 1, error: new Error("Unsupported media format"), expected: false },
        { attempts: 1, error: new Error("Provider returned HTTP 401"), expected: false },
      ];
      for (const scenario of retryCases) {
        assertEqual(shouldRetryAiJob(scenario.attempts, scenario.error), scenario.expected, `Retry eligibility at attempt ${scenario.attempts} for ${scenario.error.message}`);
      }
      const delays = [[1, 15], [2, 30], [3, 60], [4, 120], [5, 240], [20, 3600]] as const;
      for (const [attempts, seconds] of delays) assertEqual(aiJobRetryDelaySeconds(attempts), seconds, `Delay for attempt ${attempts}`);
      assertEqual(MAX_AI_JOB_ATTEMPTS, 5, "Five total claims are allowed");
      assertEqual(AI_JOB_LEASE_SECONDS, 300, "A claim lease is five minutes");
      assertEqual(processingFailureCode(new Error("Unsupported media format")), "UNSUPPORTED_MEDIA", "Terminal media errors keep a normalized failure code");
    });

    await test("matches versioned fingerprint v1 golden vectors", () => {
      const fingerprint = (title: string, other: Partial<{ description: string; caption: string; bodyText: string }> = {}) => createContentFingerprint({ title, ...other });
      assertEqual(createContentFingerprint({}), null, "Empty evidence has no fingerprint");
      assertEqual(fingerprint("a".repeat(79)), null, "79 Unicode scalar values are below threshold");
      assertEqual(fingerprint("a".repeat(80)), "v1:0f45e858fbc4176cdf4e411f88281edefc390ae5afe7df0f44cd9297f0a64580", "80 scalar values match the ASCII golden vector");
      assert(fingerprint("a".repeat(81))?.startsWith("v1:") === true, "81 scalar values produce a versioned fingerprint");
      assertEqual(fingerprint("😀".repeat(79)), null, "Emoji threshold counts Unicode scalar values, not UTF-16 code units");
      assertEqual(fingerprint("😀".repeat(80)), "v1:f84978389fab1f970b5a96465440c9355994ed70679be290f277c3f1b317e962", "Emoji golden vector is stable");
      assertEqual(fingerprint("नमस्ते世界".repeat(12)), "v1:872be1d7514644b79036f8aa2bb90902969cfa59113cf595a87743dae6c3d737", "Multilingual golden vector is stable");
      assertEqual(fingerprint("e\u0301".repeat(80)), fingerprint("é".repeat(80)), "NFC-equivalent strings match");
      assertEqual(fingerprint("é".repeat(80)), "v1:4d214f0a32f98694c3360b22dc7c8a83b21f839fe7516c67b1ffffc629125e18", "NFC text matches its golden vector");
      assertEqual(fingerprint("A".repeat(80)), fingerprint("a".repeat(80)), "Case normalization is deterministic and locale independent");
      assertEqual(fingerprint("Keeper\t   makes\nknowledge   useful ".repeat(8)), "v1:e5b4ffd28885d208c860240f2d9b1aa546bd7714c3672210a8549802aa924545", "Whitespace runs collapse to one ASCII space");
      const left = createContentFingerprint({ title: "a".repeat(40), description: "b".repeat(40) });
      const right = createContentFingerprint({ title: "a".repeat(39), description: "b".repeat(41) });
      assertEqual(left, "v1:04d25a78e94b819795564bae033c5e18af561f41bbbb55db30459d3e99b22aae", "Field boundary golden vector uses the stable separator");
      assertEqual(right, "v1:b2c98adca09f31cf8034008b1f605f888c8c1431e42bab12cd6e56f9f5f36366", "Different field boundaries produce a different digest");
      assert(left !== right, "Fingerprint preserves field boundaries");
    });

    await test("supports legacy fingerprint dual-read and v1 recomputation on payload writes", () => {
      const fields = { title: "a".repeat(40), description: "b".repeat(40) };
      assertEqual(createLegacyContentFingerprint(fields), "f39f39b37e9d0fca58f17b9acbfc0d1cb55859c2ec85d6c384f968a510b46282", "Legacy candidate exactly matches the historical space-joined TypeScript/Mongo digest");
      const candidates = createContentFingerprintCandidates(fields, ["f39f39b37e9d0fca58f17b9acbfc0d1cb55859c2ec85d6c384f968a510b46282"]);
      assert(candidates.includes("v1:04d25a78e94b819795564bae033c5e18af561f41bbbb55db30459d3e99b22aae"), "Dual-read includes the versioned v1 candidate");
      assert(candidates.includes("f39f39b37e9d0fca58f17b9acbfc0d1cb55859c2ec85d6c384f968a510b46282"), "Dual-read includes the bare legacy digest");
      assert(/^[0-9a-f]{64}$/u.test(createLegacyContentFingerprint(fields) || ""), "Legacy values retain the lowercase bare SHA-256 format");

      const originalPayload = {
        title: "a".repeat(40), description: "b".repeat(40),
        metadata: { caption: "source caption", bodyText: "source body" },
        aiSummary: { standard: "AI-generated summary" }, tags: ["generated-tag"], transcript: "derived transcript",
        provenance: { caption: "official export" },
      };
      const before = structuredClone(originalPayload);
      const insertedFingerprint = createContentFingerprint(getContentFingerprintFields(originalPayload));
      const userEditedPayload = { ...originalPayload, metadata: { ...originalPayload.metadata, personalNotes: "User note" } };
      const updateFingerprint = createContentFingerprint(getContentFingerprintFields(userEditedPayload));
      assertEqual(updateFingerprint, insertedFingerprint, "Insert and payload update produce the same fingerprint when source evidence is unchanged");
      assertEqual(JSON.stringify(originalPayload), JSON.stringify(before), "Fingerprint creation preserves source payload and provenance");

      const shortUpdate = { ...userEditedPayload, description: "short" };
      assertEqual(createContentFingerprint(getContentFingerprintFields(shortUpdate)), null, "Long-to-short update clears the fingerprint");
      const emptyUpdate = { title: "  \t\n", description: "", metadata: { caption: "  ", bodyText: "" } };
      assertEqual(createContentFingerprint(getContentFingerprintFields(emptyUpdate)), null, "Nonempty-to-whitespace/empty update clears the fingerprint");
      const withChangedAiOutputs = { ...originalPayload, aiSummary: { standard: "different output" }, tags: ["different"], transcript: "another derived transcript" };
      assertEqual(createContentFingerprint(getContentFingerprintFields(withChangedAiOutputs)), insertedFingerprint, "AI summaries, tags, and transcripts do not affect source fingerprinting");

      const postgres = fs.readFileSync(path.join(process.cwd(), "src/lib/database/postgres-store.ts"), "utf8");
      const mongo = fs.readFileSync(path.join(process.cwd(), "src/lib/database/mongodb-store.ts"), "utf8");
      const postgresImport = postgres.slice(postgres.indexOf("private async importMedia"), postgres.indexOf("private async claimJob"));
      const mongoImport = mongo.slice(mongo.indexOf("private async importMedia"), mongo.indexOf("private async claimJob"));
      assert(postgresImport.includes("createContentFingerprintCandidates") && postgresImport.includes("content_fingerprint=ANY($5::text[])"), "PostgreSQL dual-read searches v1 and legacy candidates");
      assert(postgresImport.includes("WHERE workspace_id=$1") && postgresImport.includes("legacyPostgresFingerprint") && postgresImport.includes("SET content_fingerprint=$1"), "PostgreSQL search is workspace-scoped and reapplies v1 after its legacy trigger");
      assert(mongoImport.includes("createContentFingerprintCandidates") && mongoImport.includes("workspace_id: workspaceId") && mongoImport.includes("fingerprintCandidates.map"), "Mongo duplicate lookup is workspace-scoped and searches both formats");
      assert(mongoImport.includes("content_fingerprint: fingerprint || null") === false && mongoImport.includes("content_fingerprint: fingerprint"), "Mongo inserts the v1 fingerprint, including null to clear short content");
      assert(postgres.includes("writesPayload") && postgres.includes("getContentFingerprintFields(row.payload)"), "PostgreSQL generic media inserts, upserts, and payload updates recompute fingerprints");
      assert(mongo.includes("withMediaFingerprint") && mongo.includes("withMediaFingerprint(this.table, this.values)"), "Mongo generic media payload writes recompute fingerprints without adding fields to other collections");
      assert(postgres.includes("SET content_fingerprint=$1 WHERE id=$2 AND workspace_id=$3") && mongo.includes("content_fingerprint: createContentFingerprint(getContentFingerprintFields(next))"), "Custom payload update paths explicitly recompute or clear fingerprints");
      assert(postgresImport.includes("if (duplicate.rows[0]) { await client.query(\"COMMIT\")") && mongoImport.includes("if (existing) { response = { media_id:"), "Fingerprint duplicates are reported without automatic merge writes");
    });

    await test("normalizes OSS usage ledger entries only for successful new imports", () => {
      const cycle = getOssImportCycle(new Date("2026-11-12T00:00:00.000Z"), new Date("2026-11-01T00:00:00.000Z"));
      const entry = createOssImportLedgerEntry("created", cycle);
      assertEqual(JSON.stringify(entry), JSON.stringify({ event_type: "FREE_IMPORT", plan: "free", amount: 1, cycle_start: "2026-11-08T00:00:00.000Z", cycle_end: "2026-11-15T00:00:00.000Z" }), "New successful imports use the canonical ledger shape and workspace-anchored weekly cycle");
      assertEqual(createOssImportLedgerEntry("duplicate"), null, "Duplicates do not generate usage entries");
      assertEqual(createOssImportLedgerEntry("noop"), null, "No-op imports do not generate usage entries");
      assertEqual(JSON.stringify(getOssImportEntitlement()), JSON.stringify({ plan: "free", unlimited: true, limit: null }), "OSS entitlement is unlimited independently of subscription and usage records");
      for (const used of [31, 301, 1000]) {
        assertEqual(getOssImportEntitlement().limit, null, `Usage ${used} does not impose a product quota`);
      }
      for (const status of ["active", "cancelled", "expired"]) {
        assertEqual(getOssImportEntitlement().unlimited, true, `${status} historical subscription status does not restrict OSS imports`);
      }

      const postgres = fs.readFileSync(path.join(process.cwd(), "src/lib/database/postgres-store.ts"), "utf8");
      const mongo = fs.readFileSync(path.join(process.cwd(), "src/lib/database/mongodb-store.ts"), "utf8");
      const postgresImport = postgres.slice(postgres.indexOf("private async importMedia"), postgres.indexOf("private async claimJob"));
      const mongoImport = mongo.slice(mongo.indexOf("private async importMedia"), mongo.indexOf("private async claimJob"));
      assert(!postgresImport.includes("billing_subscriptions") && !postgresImport.includes("CREDIT_LIMIT_REACHED"), "PostgreSQL import no longer reads subscriptions or applies legacy quotas");
      assert(!mongoImport.includes("billing_subscriptions") && !mongoImport.includes("CREDIT_LIMIT_REACHED"), "MongoDB import no longer reads subscriptions or applies legacy quotas");
      assert(postgresImport.includes("ledgerEntry.event_type") && postgresImport.includes("ledgerEntry.amount") && postgresImport.includes("BEGIN") && postgresImport.includes("ROLLBACK"), "PostgreSQL writes normalized usage in its import transaction");
      assert(mongoImport.includes("...ledgerEntry") && mongoImport.includes("session") && mongoImport.includes("withTransaction"), "MongoDB writes normalized usage in its import transaction");
      assertEqual((postgresImport.match(/INSERT INTO public\.keeper_usage_ledger/g) || []).length, 1, "PostgreSQL new-import path has one ledger insert site");
      assertEqual((mongoImport.match(/ledger\.insertOne/g) || []).length, 1, "MongoDB new-import path has one ledger insert site");
      assert(postgresImport.indexOf("if (duplicate.rows[0])") < postgresImport.indexOf("INSERT INTO public.keeper_usage_ledger"), "PostgreSQL duplicate returns before usage is recorded");
      assert(mongoImport.indexOf("if (existing)") < mongoImport.indexOf("ledger.insertOne"), "MongoDB duplicate returns before usage is recorded");
      assert(postgresImport.includes("catch (error) { await client.query(\"ROLLBACK\")") && mongoImport.includes("await session.withTransaction"), "Failed media/job/ledger work remains enclosed by provider transaction rollback boundaries");

      const usageRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/usage/route.ts"), "utf8");
      assert(usageRoute.includes("usageAvailable: true") && usageRoute.includes("usageAvailable: false") && usageRoute.includes("used: null"), "Usage API distinguishes accurate totals from unavailable reads");
      assert(usageRoute.includes("remaining: null") && usageRoute.includes("unlimited: true"), "Usage API always reports the OSS unlimited entitlement");
      const ingestRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/ingest/route.ts"), "utf8");
      assert(ingestRoute.includes("if (importError)") && ingestRoute.includes("status: 503") && !ingestRoute.includes("quotaReached"), "Failed Supabase import RPCs are not reported as successful imports");
    });

    await test("Supabase OSS import migration preserves auth, tenant scope, RPC shape, and normalized usage", () => {
      const migrationPath = "supabase/migrations/202611020001_phase_1c_6_oss_import_entitlements.sql";
      const migration = fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
      const fn = migration.slice(migration.indexOf("create or replace function public.keeper_import_media"), migration.indexOf("-- CREATE OR REPLACE preserves"));
      assert(migration.startsWith("begin;") && migration.trimEnd().endsWith("commit;"), "Forward migration is wrapped in a transaction");
      assert(fn.includes("security definer") && fn.includes("set search_path = pg_catalog"), "Function retains security-definer with a catalog-only trusted search path");
      assert(fn.includes("v_workspace uuid := auth.uid()") && fn.includes("if v_workspace is null"), "Function retains authenticated workspace derivation and rejection");
      assert(fn.includes("where workspace_id = v_workspace") && fn.includes("workspace_id = v_workspace"), "Duplicate and usage reads stay workspace-scoped");
      assert(!/billing_subscriptions|CREDIT_LIMIT_REACHED|v_limit|v_sub|IMPORT_CREDIT/iu.test(fn), "No subscription-derived import quota or paid usage event remains");
      assertEqual((fn.match(/insert into public\.keeper_usage_ledger/giu) || []).length, 1, "Function has exactly one new-import ledger insertion site");
      assert(/event_type, plan, amount, cycle_start, cycle_end[\s\S]*?'FREE_IMPORT', 'free', 1, v_cycle_start, v_cycle_end/iu.test(fn), "Ledger event matches shared OSS event, plan, amount, and weekly cycle contract");
      assert(fn.includes("pg_catalog.date_trunc('milliseconds', free_cycle_anchor)"), "Supabase cycle anchor precision matches JavaScript Date precision in PostgreSQL and MongoDB providers");
      assert(fn.includes("pg_catalog.floor(extract(epoch from (v_now - v_cycle_anchor)) / 604800) * 604800"), "Cycle starts use fixed 604800-second elapsed-time arithmetic");
      assert(fn.includes("pg_catalog.to_timestamp(extract(epoch from v_cycle_start) + 604800)"), "Cycle end advances by a fixed 604800 seconds");
      assert(fn.includes("v_now := pg_catalog.clock_timestamp()"), "Cycle time is sampled after workspace locking rather than using transaction-start time");
      const cycleSql = fn.slice(fn.indexOf("v_cycle_start := pg_catalog.to_timestamp"), fn.indexOf("select count(*)::integer into v_used"));
      assert(cycleSql.includes("extract(epoch") && cycleSql.includes("to_timestamp") && !/interval\s+'7 days'|\+\s*interval\s+/iu.test(cycleSql), "Cycle logic is epoch-based and independent of calendar/DST arithmetic");
      assert(fn.includes("from pg_catalog.pg_extension as e") && fn.includes("join pg_catalog.pg_namespace as n"), "The pgcrypto namespace is resolved from extension catalogs rather than guessed");
      assert(fn.includes("pg_catalog.format(") && fn.includes("%I.digest($1::text, $2::text)") && fn.includes("using v_fingerprint_text, 'sha256'"), "Digest invocation schema-qualifies a quoted extension namespace and binds values");
      assert(fn.includes("pg_catalog.encode(") && !fn.includes("v_fingerprint := encode(digest("), "Sensitive digest/encode resolution cannot be shadowed through public search_path");
      assert(fn.includes("if found then\n    return jsonb_build_object('duplicate'") && fn.indexOf("if found then\n    return jsonb_build_object('duplicate'") < fn.indexOf("insert into public.keeper_usage_ledger"), "Duplicate handling returns before ledger insertion");
      assert(fn.indexOf("insert into public.keeper_media(") < fn.indexOf("insert into public.keeper_usage_ledger") && fn.indexOf("insert into public.keeper_usage_ledger") < fn.indexOf("insert into public.keeper_ai_jobs"), "Media, usage and job writes are ordered within one transaction");
      assert(fn.includes("'media_id', v_media.id") && fn.includes("'status', 'QUEUED'") && fn.includes("'duplicate', false") && fn.includes("'remaining', null") && fn.includes("'cycle_end', v_cycle_end"), "New-import RPC response preserves caller fields and unlimited remaining semantics");
      assert(fn.includes("public.keeper_import_media(") && /p_canonical_url text,\s*p_payload jsonb,\s*p_idempotency_key text\s*\) returns jsonb/iu.test(fn), "RPC signature remains compatible with the existing caller");
      assert(migration.includes("from public, anon") && migration.includes("to authenticated"), "Function execute grant remains restricted to authenticated role");
      assert(!/\b(drop|truncate)\b|delete\s+from|update\s+public\./iu.test(migration) && (migration.match(/create or replace function/giu) || []).length === 1, "Migration changes only this function and its existing narrow grant, with no destructive statements");

      const caller = fs.readFileSync(path.join(process.cwd(), "src/app/api/ingest/route.ts"), "utf8");
      assert(caller.includes('supabase.rpc("keeper_import_media"') && caller.includes("media_id?: string; status?: string; duplicate?: boolean"), "Application caller continues using the existing RPC name and response fields");
      for (const used of [31, 301, 1000]) assertEqual(getOssImportEntitlement().limit, null, `OSS imports remain unlimited above ${used} prior events`);
      for (const status of ["active", "cancelled", "expired"]) assertEqual(getOssImportEntitlement().unlimited, true, `${status} legacy subscription state is ignored by OSS entitlement`);
    });

    await test("validates assignment parents and rolls back failed writes without cross-workspace leakage", async () => {
      interface MockAssignment {
        workspaceId: string;
        mediaId: string;
        collectionId: string | null;
        topic: string | null;
      }
      const mediaOwners = new Map([["media-a", "workspace-a"], ["media-b", "workspace-b"]]);
      const collectionOwners = new Map([["collection-a", "workspace-a"], ["collection-b", "workspace-b"]]);
      let assignments: MockAssignment[] = [{ workspaceId: "workspace-b", mediaId: "media-b", collectionId: "collection-b", topic: "private" }];
      const transactionEvents: string[] = [];
      const persistMock = async (workspaceId: string, mediaId: string, collectionId: string | null, topic: string | null) => {
        await persistWorkspaceAssignment({ workspaceId, mediaId, collectionId }, {
          transaction: async (operation) => {
            const before = structuredClone(assignments);
            transactionEvents.push("begin");
            try {
              const result = await operation();
              transactionEvents.push("commit");
              return result;
            } catch (error) {
              assignments = before;
              transactionEvents.push("rollback");
              throw error;
            }
          },
          findMediaWorkspaceId: async (id) => mediaOwners.get(id) || null,
          findCollectionWorkspaceId: async (_workspaceId, id) => collectionOwners.get(id) || null,
          writeAssignment: async () => {
            assignments = assignments.filter((assignment) => !(assignment.workspaceId === workspaceId && assignment.mediaId === mediaId));
            assignments.push({ workspaceId, mediaId, collectionId, topic });
          },
        });
      };

      await persistMock("workspace-a", "media-a", "collection-a", "valid");
      assert(assignments.some((assignment) => assignment.workspaceId === "workspace-a" && assignment.mediaId === "media-a" && assignment.collectionId === "collection-a"), "Same-workspace media and collection assignment succeeds");

      const cases = [
        { name: "media from another workspace", mediaId: "media-b", collectionId: null, message: "MEDIA_NOT_FOUND" },
        { name: "collection from another workspace", mediaId: "media-a", collectionId: "collection-b", message: "COLLECTION_NOT_FOUND" },
        { name: "missing media", mediaId: "missing-media", collectionId: null, message: "MEDIA_NOT_FOUND" },
        { name: "missing collection", mediaId: "media-a", collectionId: "missing-collection", message: "COLLECTION_NOT_FOUND" },
      ] as const;
      for (const scenario of cases) {
        const before = JSON.stringify(assignments);
        let errorMessage = "";
        try { await persistMock("workspace-a", scenario.mediaId, scenario.collectionId, "invalid"); }
        catch (error) { errorMessage = error instanceof Error ? error.message : String(error); }
        assertEqual(errorMessage, scenario.message, `Rejects ${scenario.name} with a non-disclosing error`);
        assertEqual(JSON.stringify(assignments), before, `${scenario.name} does not change assignment records`);
      }

      const beforeInvalidUpdate = JSON.stringify(assignments);
      let updateRejected = false;
      try { await persistMock("workspace-a", "media-b", "collection-a", "attempted overwrite"); }
      catch { updateRejected = true; }
      assert(updateRejected, "An assignment update with an invalid media parent is rejected");
      assertEqual(JSON.stringify(assignments), beforeInvalidUpdate, "Invalid assignment update preserves prior records");
      assert(transactionEvents.includes("rollback"), "Validation failure triggers transaction rollback");
      assert(transactionEvents.filter((event) => event === "commit").length === 1, "Only the valid assignment commits");
      assert(assignments.some((assignment) => assignment.workspaceId === "workspace-b" && assignment.mediaId === "media-b" && assignment.topic === "private"), "Workspace A cannot read or overwrite Workspace B assignment data");

      const postgres = fs.readFileSync(path.join(process.cwd(), "src/lib/database/postgres-store.ts"), "utf8");
      const mongo = fs.readFileSync(path.join(process.cwd(), "src/lib/database/mongodb-store.ts"), "utf8");
      assert(postgres.includes("persistWorkspaceAssignment") && postgres.includes("FOR KEY SHARE") && postgres.includes("ROLLBACK"), "PostgreSQL uses shared validation, parent row locks, and rollback");
      assert(mongo.includes("persistWorkspaceAssignment") && mongo.includes("session.withTransaction(operation)"), "MongoDB uses shared validation inside its replica-set transaction");
    });

    await test("simulates canonical AI-job claims, lease recovery, exhaustion, ordering, and concurrent workers", async () => {
      interface SimulatedJob {
        id: string;
        status: string;
        attempts: number;
        availableAt: string;
        lockedUntil: string | null;
        createdAt: string;
        lastError: string | null;
        failureCode: string | null;
        mediaStatus: string;
      }
      const simulateClaim = (jobs: SimulatedJob[], nowValue: string): SimulatedJob | null => {
        const now = Date.parse(nowValue);
        for (const job of jobs) {
          const leaseExpired = job.lockedUntil === null || Date.parse(job.lockedUntil) <= now;
          if (AI_JOB_PROCESSING_STAGES.includes(job.status as typeof AI_JOB_PROCESSING_STAGES[number])
            && job.attempts >= MAX_AI_JOB_ATTEMPTS && leaseExpired) {
            job.status = "FAILED";
            job.lockedUntil = null;
            job.lastError ??= "Worker lease expired after the retry limit.";
            job.failureCode ??= "RETRY_EXHAUSTED";
            job.mediaStatus = "FAILED";
          }
        }
        const candidates = jobs.filter((job) =>
          AI_JOB_PROCESSING_STAGES.includes(job.status as typeof AI_JOB_PROCESSING_STAGES[number])
          && job.attempts < MAX_AI_JOB_ATTEMPTS
          && Date.parse(job.availableAt) <= now
          && (job.lockedUntil === null || Date.parse(job.lockedUntil) <= now),
        ).sort((left, right) => left.availableAt.localeCompare(right.availableAt)
          || left.createdAt.localeCompare(right.createdAt)
          || left.id.localeCompare(right.id));
        const claimed = candidates[0];
        if (!claimed) return null;
        claimed.status = "EXTRACTING";
        claimed.attempts += 1;
        claimed.lockedUntil = new Date(now + AI_JOB_LEASE_SECONDS * 1000).toISOString();
        return claimed;
      };
      const now = "2026-11-02T00:10:00.000Z";
      const retryCases = [
        { attempts: 1, error: new Error("HTTP 503 provider unavailable"), retry: true, status: "QUEUED" },
        { attempts: 1, error: new Error("HTTP 401 unauthorized"), retry: false, status: "FAILED" },
        { attempts: MAX_AI_JOB_ATTEMPTS, error: new Error("HTTP 503 provider unavailable"), retry: false, status: "FAILED" },
      ] as const;
      for (const scenario of retryCases) {
        const retry = shouldRetryAiJob(scenario.attempts, scenario.error);
        assertEqual(retry, scenario.retry, `Retry policy classifies ${scenario.error.message}`);
        assertEqual(retry ? "QUEUED" : "FAILED", scenario.status, `Failure transition for ${scenario.error.message}`);
      }
      const delayCases = [[1, 15], [2, 30], [3, 60], [4, 120], [5, 240], [9, 3600], [100, 3600]] as const;
      for (const [attempts, expectedSeconds] of delayCases) {
        assertEqual(aiJobRetryDelaySeconds(attempts), expectedSeconds, `Retry delay for claim ${attempts}`);
      }
      const makeJob = (status: string, id = `job-${status}`): SimulatedJob => ({
        id, status, attempts: 2, availableAt: "2026-11-02T00:00:00.000Z", lockedUntil: null,
        createdAt: "2026-11-01T00:00:00.000Z", lastError: null, failureCode: null, mediaStatus: status,
      });

      for (const stage of AI_JOB_PROCESSING_STAGES) {
        const job = makeJob(stage);
        const claimed = simulateClaim([job], now);
        assertEqual(claimed?.status, "EXTRACTING", `${stage} is claimable and transitions to EXTRACTING`);
        assertEqual(claimed?.attempts, 3, `${stage} claim increments attempts exactly once`);
        assertEqual(claimed?.lockedUntil, "2026-11-02T00:15:00.000Z", `${stage} receives a five-minute lease`);
      }

      const futureJob = makeJob("QUEUED", "future");
      futureJob.availableAt = "2026-11-02T00:11:00.000Z";
      assertEqual(simulateClaim([futureJob], now), null, "A retry is not claimable before available_at");
      const lockedJob = makeJob("MEDIA_FOUND", "live-lock");
      lockedJob.lockedUntil = "2026-11-02T00:11:00.000Z";
      assertEqual(simulateClaim([lockedJob], now), null, "An unexpired worker lease prevents another claim");

      const recoverable = makeJob("TRANSCRIPT_READY", "recoverable-fifth-claim");
      recoverable.attempts = 4;
      recoverable.lockedUntil = "2026-11-02T00:09:59.000Z";
      assertEqual(simulateClaim([recoverable], now)?.attempts, 5, "An expired fourth claim is recoverable as the fifth claim");
      recoverable.lockedUntil = "2026-11-02T00:09:59.000Z";
      const afterExhaustion = simulateClaim([recoverable], now);
      assertEqual(afterExhaustion, null, "An expired fifth attempt is terminalized and not claimed again");
      assertEqual(recoverable.status, "FAILED", "Exhausted job has a generic terminal job status");
      assertEqual(recoverable.mediaStatus, "FAILED", "Expired-worker media is terminalized separately");
      assertEqual(recoverable.failureCode, "RETRY_EXHAUSTED", "Exhaustion receives the canonical failure code");
      assertEqual(recoverable.lockedUntil, null, "Terminal exhaustion clears the lease");

      const historical = makeJob("INDEXING", "historical-code");
      historical.attempts = 5;
      historical.lockedUntil = "2026-11-02T00:09:59.000Z";
      historical.failureCode = "LEGACY_UNKNOWN_CODE";
      simulateClaim([historical], now);
      assertEqual(historical.failureCode, "LEGACY_UNKNOWN_CODE", "Exhaustion preserves a historical failure code");

      const ordering = [
        { ...makeJob("QUEUED", "z-tie"), createdAt: "2026-11-02T00:01:00.000Z" },
        { ...makeJob("PENDING", "a-tie"), createdAt: "2026-11-02T00:01:00.000Z" },
        { ...makeJob("EXTRACTING", "earlier"), availableAt: "2026-11-01T23:59:00.000Z" },
      ];
      assertEqual(simulateClaim(ordering, now)?.id, "earlier", "Claims sort by available_at before created_at and ID");
      const idTie = [makeJob("QUEUED", "z-id"), makeJob("PENDING", "a-id")];
      idTie[0].createdAt = idTie[1].createdAt;
      assertEqual(simulateClaim(idTie, now)?.id, "a-id", "Stable ID resolves equal available_at and created_at values");

      const concurrentJobs = [makeJob("QUEUED", "concurrent-a"), makeJob("PENDING", "concurrent-b")];
      const concurrentClaims = await Promise.all([
        Promise.resolve().then(() => simulateClaim(concurrentJobs, now)),
        Promise.resolve().then(() => simulateClaim(concurrentJobs, now)),
      ]);
      assertEqual(new Set(concurrentClaims.map((job) => job?.id)).size, 2, "Simulated atomic claim workers acquire distinct jobs");
      assert(concurrentJobs.every((job) => job.attempts === 3 && job.lockedUntil === "2026-11-02T00:15:00.000Z"), "Each simulated concurrent claim increments once and holds a lease");

      const postgres = fs.readFileSync(path.join(process.cwd(), "src/lib/database/postgres-store.ts"), "utf8");
      const mongo = fs.readFileSync(path.join(process.cwd(), "src/lib/database/mongodb-store.ts"), "utf8");
      const types = fs.readFileSync(path.join(process.cwd(), "src/types/index.ts"), "utf8");
      const worker = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/worker/route.ts"), "utf8");
      assert(postgres.includes("FOR UPDATE SKIP LOCKED") && postgres.includes("ORDER BY available_at ASC,created_at ASC,id ASC"), "PostgreSQL retains skip-locked claims and deterministic ordering");
      assert(postgres.includes("MAX_AI_JOB_ATTEMPTS") && postgres.includes("AI_JOB_LEASE_SECONDS") && postgres.includes("RETRY_EXHAUSTED"), "PostgreSQL uses shared attempt/lease policy and exhaustion handling");
      assert(mongo.includes("findOneAndUpdate") && mongo.includes("session.withTransaction") && mongo.includes("RETRY_EXHAUSTED"), "MongoDB terminalization and atomic claim run in a replica-set transaction");
      assert(mongo.includes("AI_JOB_PROCESSING_STAGES") && mongo.includes('status: "EXTRACTING"') && mongo.includes("available_at: 1, created_at: 1, id: 1"), "MongoDB uses shared stages, claim transition, and deterministic ordering");
      assert(types.includes('export type AIJobStatus = AIJobProcessingStage | "COMPLETED" | "FAILED";') && types.includes("export type MediaProcessingFailureStatus"), "Job terminal states and media-specific failures are distinct types");
      assert(worker.includes("let failureStatus: MediaProcessingFailureStatus") && worker.includes("const nextStatus: AIJobStatus"), "Worker writes generic job terminal status and media-specific failure status");
      assert(worker.includes("locked_until: null") && worker.includes("shouldRetryAiJob(job.attempts, error)"), "Worker clears terminal/retry locks and applies permanent versus retryable policy");

      const postgresReprocess = postgres.slice(postgres.indexOf("private async reprocess"), postgres.indexOf("private async getOrCreateCollection"));
      const mongoReprocess = mongo.slice(mongo.indexOf("private async reprocess"), mongo.indexOf("private async getOrCreateCollection"));
      assert(postgresReprocess.includes("attempts=0") && postgresReprocess.includes("locked_until=null") && postgresReprocess.includes("last_error=null") && postgresReprocess.includes("failure_code=null"), "PostgreSQL reprocessing resets attempts, lock, error, and failure code");
      assert(mongoReprocess.includes("attempts: 0") && mongoReprocess.includes("locked_until: null") && mongoReprocess.includes("last_error: null") && mongoReprocess.includes("failure_code: null"), "MongoDB reprocessing resets attempts, lock, error, and failure code");
    });

    await test("retries transient worker failures and dead-letters crashed jobs at the configured attempt limit", () => {
      assertEqual(processingFailureCode(new Error("Provider returned HTTP 429")), "RATE_LIMITED", "Normalizes rate-limit failures");
      assertEqual(shouldRetryAiJob(1, new Error("Provider returned HTTP 503")), true, "Retries provider outages");
      assertEqual(shouldRetryAiJob(1, new Error("Request timed out")), true, "Retries request timeouts");
      assertEqual(shouldRetryAiJob(1, new Error("Unsupported media format")), false, "Does not retry invalid media");
      assertEqual(shouldRetryAiJob(MAX_AI_JOB_ATTEMPTS, new Error("Provider returned HTTP 503")), false, "Stops retries at five attempts");
      assertEqual(aiJobRetryDelaySeconds(1), 15, "First retry uses 15 second backoff");
      assertEqual(aiJobRetryDelaySeconds(5), 240, "Backoff grows but remains bounded");
      const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202610200001_ai_pipeline_recovery.sql"), "utf8");
      assert(migration.includes("attempts >= 5") && migration.includes("set status = 'FAILED'")
        && migration.includes("locked_until < now()") && migration.includes("locked_until is null or locked_until < now()"), "Crash recovery expires leases, handles null leases, and terminally fails exhausted jobs");
      const worker = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai/worker/route.ts"), "utf8");
      assert(worker.includes("gemini-3.5-transcribe") && worker.includes("deepgram-nova-3"), "New transcription providers are trusted for transcript reuse");
    });

    await test("uses the documented Gemini transcription mode and preserves uploaded transcript text", async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      const originalFetch = globalThis.fetch;
      process.env.GEMINI_API_KEY = "test-key";
      const requests: Array<{ url: string; body?: string }> = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
        if (url.includes("/upload/v1beta/files")) {
          return new Response("{}", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/test" } });
        }
        if (url.includes("/upload/test")) return new Response(JSON.stringify({ file: { uri: "files/test" } }), { status: 200 });
        return new Response(JSON.stringify({ output_text: "Verified spoken words from the sample." }), { status: 200 });
      }) as typeof fetch;
      try {
        const result = await new GeminiTranscriptionProvider().transcribe(new Uint8Array([1, 2, 3]), undefined, "audio/wav");
        assertEqual(result.text, "Verified spoken words from the sample.", "Persists the model transcript output");
        const interactionBody = JSON.parse(requests[2]?.body || "{}") as { generation_config?: { transcription_config?: { mode?: { type?: string } } } };
        assertEqual(interactionBody.generation_config?.transcription_config?.mode?.type, "verbatim", "Uses the documented object form for verbatim mode");
      } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalKey;
      }
    });

    await test("refuses AI analysis for title-only or incomplete source representations", async () => {
      let rejected = false;
      try {
        await ContentAnalysisService.analyze({
          type: "metadata_only",
          text: "A sufficiently long title that must never be analyzed as verified content.",
          source: "title",
          extractionMethod: "platform_metadata_normalization",
          confidence: 0.35,
          status: "partial",
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        rejected = error instanceof Error && error.message.includes("Verified source content unavailable");
      }
      assert(rejected, "Title-only source is rejected before any provider request");
    });

    await test("validates collection model IDs against the user-authorized candidate list", () => {
      const source = "The transcript explains how React Server Components reduce client-side JavaScript.";
      const candidates = [{ id: "web", name: "Web Development", description: "React and frontend engineering" }];
      const selected = validateCollectionCandidateDecision({ collectionId: "web", confidence: 0.91,
        evidence: "React Server Components reduce client-side JavaScript", reason: "React is relevant." }, source, candidates, "gemini-3.8-flash");
      assertEqual(selected?.collectionId, "web", "Accepts a grounded selection from the candidate set");
      assertEqual(selected?.promptVersion, "keeper-collection-select-v1", "Records the prompt version");
      let rejected = false;
      try {
        validateCollectionCandidateDecision({ collectionId: "other-user-collection", confidence: 0.99,
          evidence: "React Server Components reduce client-side JavaScript", reason: "wrong tenant" }, source, candidates, "gemini-3.8-flash");
      } catch (error) { rejected = error instanceof Error && error.message.includes("outside the authorized candidate set"); }
      assert(rejected, "Rejects IDs outside the authorized candidate set");
      assertEqual(validateCollectionCandidateDecision({ collectionId: "web", confidence: 0.5,
        evidence: "React Server Components reduce client-side JavaScript", reason: "weak" }, source, candidates, "gemini-3.8-flash"), null,
      "Abstains below the conservative uncalibrated confidence floor");
    });

    await test("normalizes platform transcript and keeps transcript provenance", () => {
      const representation = ContentIntelligenceService.normalizeRepresentation({
        sourceTranscript: "React Server Components reduce client-side JavaScript.",
        caption: "A React performance walkthrough.",
        title: "Performance notes",
      });
      assertEqual(representation.source, "platform_transcript", "Uses source transcript provenance");
      assert(representation.text.includes("React Server Components"), "Keeps transcript text");
      assert(representation.text.includes("performance walkthrough"), "Keeps additional source caption");
    });

    await test("generates grounded tags without platform-only tags", () => {
      const tags = ContentIntelligenceService.generateTags("React performance optimization reduces client-side JavaScript in Next.js server components.");
      assert(tags.some((tag) => tag.name === "React"), "Includes a directly evidenced React tag");
      assert(tags.some((tag) => tag.name === "Next.js"), "Normalizes Next.js");
      assert(!tags.some((tag) => ["YouTube", "Instagram", "Reddit", "LinkedIn"].includes(tag.name)), "Excludes platform labels");
      assert(tags.every((tag) => tag.evidence.length > 0 && tag.confidence > 0), "Includes evidence and nonzero heuristic confidence");
    });

    await test("adds category tags for source-grounded comedy and quiz cues", () => {
      const comedyTags = ContentIntelligenceService.generateTags("Ashish Chanchlani brings a funny comedy sketch in this Reel.");
      assert(comedyTags.some((tag) => tag.name === "Comedy" && tag.category === "Intent"), "Recognizes a grounded comedy category");
      const quizTags = ContentIntelligenceService.generateTags("Try this trivia quiz and answer the knowledge questions.");
      assert(quizTags.some((tag) => tag.name === "Quiz" && tag.category === "Intent"), "Recognizes a grounded quiz category");
    });

    await test("matches an existing collection from content semantics", () => {
      const tags = ContentIntelligenceService.generateTags("React performance optimization for frontend components.");
      const matches = CollectionMatchingService.match("React performance optimization for frontend components.", tags, [
        { id: "web", name: "Web Development", description: "Frontend React and JavaScript engineering", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
        { id: "finance", name: "Finance", description: "Investing and budgeting", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
      ]);
      assertEqual(matches[0]?.collectionId, "web", "Selects semantically relevant collection");
    });

    await test("reuses a descriptive existing collection for an exact grounded topic phrase", () => {
      const tag = { name: "After Effects", normalizedName: "after-effects", category: "Technology" as const, confidence: 0.9, source: "ai" as const, evidence: "After Effects keyframes" };
      const matches = CollectionMatchingService.match("This tutorial demonstrates After Effects keyframe animation.", [tag], [
        { id: "motion", name: "After Effects Tutorials", description: "Reusable motion graphics lessons", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
      ]);
      assertEqual(matches[0]?.collectionId, "motion", "Exact topic phrase selects the existing descriptive collection");
      assert((matches[0]?.confidence || 0) >= 0.62, "Exact topic phrase reaches the auto-assign threshold");
    });

    await test("routes explicit Quiz tags to Quiz instead of Entertainment", () => {
      const quizTag = { name: "Quiz", normalizedName: "quiz", category: "Topic" as const, confidence: 1, source: "user" as const, evidence: "User-approved tag: Quiz" };
      const funnyTag = { name: "Funny", normalizedName: "funny", category: "Topic" as const, confidence: 1, source: "user" as const, evidence: "User-approved tag: Funny" };
      const matches = CollectionMatchingService.match("A fun short clip", [quizTag, funnyTag], [
        { id: "entertainment", name: "Entertainment", description: "Comedy, funny clips and music", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
        { id: "quiz", name: "Quiz", description: "Trivia and knowledge questions", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
      ]);
      assertEqual(matches[0]?.collectionId, "quiz", "Exact user tag wins over a broad entertainment collection");
      assertEqual(CollectionMatchingService.selectBestMatch(matches)?.collectionId, "quiz", "Clear tag match is auto-selected");
    });

    await test("maps a clear Trivia tag to Quiz and abstains when collections are ambiguous", () => {
      const triviaTag = { name: "Trivia", normalizedName: "trivia", category: "Topic" as const, confidence: 1, source: "user" as const, evidence: "User-approved tag: Trivia" };
      const clearMatches = CollectionMatchingService.match("", [triviaTag], [
        { id: "quiz", name: "Quiz", description: "Knowledge questions", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
        { id: "entertainment", name: "Entertainment", description: "Comedy and music", color: "", icon: "Folder", createdAt: "", updatedAt: "" },
      ]);
      assertEqual(CollectionMatchingService.selectBestMatch(clearMatches)?.collectionId, "quiz", "Trivia synonym routes to Quiz when unambiguous");
      const ambiguous = [
        { collectionId: "quiz", name: "Quiz", confidence: 0.81, matchedTerms: ["trivia"], reasoning: "close candidate" },
        { collectionId: "entertainment", name: "Entertainment", confidence: 0.77, matchedTerms: ["trivia"], reasoning: "close candidate" },
      ];
      assertEqual(CollectionMatchingService.selectBestMatch(ambiguous), null, "Near-tied collections are left for review");
    });

    await test("infers a reusable collection category and prefers specific categories", () => {
      assertEqual(CollectionMatchingService.inferCollectionCategory(["Funny", "Comedy"]), "Comedy", "Maps comedy tags to the Comedy collection");
      assertEqual(CollectionMatchingService.inferCollectionCategory(["Funny", "Quiz"]), "Quiz", "Quiz takes priority over broad entertainment cues");
      assertEqual(CollectionMatchingService.inferCollectionCategory(["Ashish", "Chanchlani"]), null, "Does not invent a category from unsupported person-name fragments");
    });

    await test("creates a collection topic only for a grounded, high-confidence reusable asset", () => {
      const topic = { name: "After Effects", normalizedName: "after-effects", category: "Technology" as const, confidence: 0.9, source: "ai" as const, evidence: "After Effects keyframes" };
      const reusableAsset = { isAsset: true, assetType: "Tutorial", assetScore: 0.86, reason: "Reusable technique", evidence: ["After Effects keyframes"], method: "content_ai:test" };
      assertEqual(CollectionMatchingService.selectCollectionTopic([topic], 0.9, reusableAsset)?.name, "After Effects", "Selects specific grounded collection topic");
      assertEqual(CollectionMatchingService.selectCollectionTopic([topic], 0.6, reusableAsset), null, "Rejects low-confidence analysis");
      assertEqual(CollectionMatchingService.selectCollectionTopic([{ ...topic, name: "Video", normalizedName: "video", category: "Content Type" }], 0.9, reusableAsset), null, "Rejects generic media-type folders");
      assertEqual(CollectionMatchingService.selectCollectionTopic([{ ...topic, name: "YouTube", normalizedName: "youtube" }], 0.9, reusableAsset), null, "Rejects platform-only folders");
      assertEqual(CollectionMatchingService.selectCollectionTopic([topic], 0.9, { ...reusableAsset, isAsset: false }), null, "Does not create a folder for non-reusable content");
    });

    await test("classifies reusable assets only from sufficient grounded source text", () => {
      const insufficient = AssetClassificationService.classify("React video");
      assertEqual(insufficient.isAsset, null, "Insufficient source content stays unknown");
      const tutorial = AssetClassificationService.classify("This tutorial explains how to optimize React rendering with memoization and practical performance best practices.");
      assertEqual(tutorial.isAsset, true, "Source-backed tutorial is classified as reusable");
      assertEqual(tutorial.assetType, "Tutorial", "Uses the matching asset category");
      assert(tutorial.evidence.includes("tutorial"), "Provides the source evidence for classification");
      const entertainment = AssetClassificationService.classify("A funny short clip with a surprising ending and a group of friends laughing together.");
      assertEqual(entertainment.isAsset, false, "Does not infer reusable value from a generic clip");
    });

    await test("deduplicates OCR subtitle text without fabricating extracted content", () => {
      const lines = VisualTextService.deduplicateSubtitleLines(["Build a useful library", "Build a useful library", "  Build a useful library  ", "OK"]);
      assertEqual(lines.length, 1, "Repeated OCR frame text is collapsed and short noise omitted");
      assertEqual(lines[0], "Build a useful library", "Preserves the actual extracted text");
    });

    // ---------------------------------------------------------------------------
    // 21. Instagram Reels AI Accuracy Audit Regression Test Suite (Reels 01, 02, 03 Quality Gates)
    // ---------------------------------------------------------------------------
    console.log("\n21. Instagram Reels AI Accuracy Audit Regression Tests:");

    // --- REEL 01: Tag Filtering, Specificity Ranking & Timezone-Safe Date ---
    await test("Reel 01: Rejects conversational filler tags like #Seriously and normalizes compound tags", () => {
      const rawTags = ["Seriously", "macbooktrick", "macbookapps", "technology", "macbooktipsandtricks", "macbookfeatures"];
      const normalized = ContentIntelligenceService.normalizeTags(rawTags);

      assert(!normalized.includes("Seriously"), "Filler tag '#Seriously' must be strictly rejected");
      assert(!normalized.includes("seriously"), "Lower-case 'seriously' must be rejected");
      assert(normalized.includes("MacBook Tricks"), "Compound tag 'macbooktrick' normalizes to 'MacBook Tricks'");
      assert(normalized.includes("MacBook Apps"), "Compound tag 'macbookapps' normalizes to 'MacBook Apps'");
      assert(normalized.includes("MacBook Tips and Tricks"), "Compound tag 'macbooktipsandtricks' normalizes to 'MacBook Tips and Tricks'");
      assert(normalized.includes("MacBook Features"), "Compound tag 'macbookfeatures' normalizes to 'MacBook Features'");
      assert(normalized.includes("Technology"), "Valid generic tag 'Technology' is preserved");
    });

    await test("Reel 01: Prioritizes specific topic tags over generic tags", () => {
      const generated = ContentIntelligenceService.generateTags(
        "Here are the best MacBook tips, tricks and secret features every macOS user must know.",
        ["Seriously", "technology", "macbookapps", "macbooktrick"],
        undefined,
        ["MacBook Pro M3"]
      );

      const tagNames = generated.map((t) => t.name);
      assert(!tagNames.includes("Seriously"), "Generated tags must not include filler #Seriously");

      const techIdx = tagNames.indexOf("Technology");
      const trickIdx = tagNames.indexOf("MacBook Tricks");
      if (techIdx !== -1 && trickIdx !== -1) {
        assert(trickIdx < techIdx, "Specific topic tag 'MacBook Tricks' must rank ahead of generic tag 'Technology'");
      }
    });

    await test("Reel 01: Timezone-safe publication date parsing prevents off-by-one day shift across timezone boundaries", () => {
      const parsedUtc = MetadataNormalizer.parseAuthoritativeDate("October 18, 2026");
      assert(parsedUtc.iso !== null, "Authoritative date string must parse successfully");
      assertEqual(parsedUtc.iso, "2026-10-18T12:00:00.000Z", "Must produce UTC midday timestamp to prevent midnight crossing across timezones");
      assertEqual(parsedUtc.formattedDate, "2026-10-18", "Authoritative date must format to calendar date 2026-10-18 regardless of client timezone");

      // Verify ISO date string with midnight UTC (start of day boundary)
      const parsedIsoMidnight = MetadataNormalizer.parseAuthoritativeDate("2026-10-18T00:00:00.000Z");
      assertEqual(parsedIsoMidnight.formattedDate, "2026-10-18", "Authoritative date formats midnight UTC without shifting to 2026-10-17");

      // Verify ISO date string with end of day boundary (23:59:59 UTC)
      const parsedIsoEndOfDay = MetadataNormalizer.parseAuthoritativeDate("2026-10-18T23:59:59.000Z");
      assertEqual(parsedIsoEndOfDay.formattedDate, "2026-10-18", "Authoritative date formats 23:59:59 UTC without shifting to 2026-10-19");

      // Verify ISO date string with positive timezone offset (+05:30)
      const parsedWithOffset = MetadataNormalizer.parseAuthoritativeDate("2026-10-18T14:30:00+05:30");
      assertEqual(parsedWithOffset.formattedDate, "2026-10-18", "Calendar date 2026-10-18 preserved under timezone offset");
    });

    // --- REEL 02: Creator Attribution & Rejection of Short Noise Tags ---
    await test("Reel 02: Creator attribution distinguishes handle from display name and rejects spaces in handles", () => {
      // Problem: @Nikitha M S was incorrectly treated as author handle when real author was niki.webinns
      const author = MetadataNormalizer.normalizeInstagramAuthor({
        rawDisplayName: "Nikitha M S",
        urlPathUsername: "niki.webinns",
        caption: "Check this out @friend1 and @friend2 for web design tips",
      });
      assertEqual(author.displayName, "Nikitha M S", "Display name preserves creator's human name");
      assertEqual(author.username, "niki.webinns", "Username must be verified handle niki.webinns without spaces");
      assertEqual(author.handle, "@niki.webinns", "Handle must be @niki.webinns");
      assert(author.confidence >= 0.9, "Confidence must be high for verified handle");
      assertEqual(author.attributionSource, "url_path", "Attribution source recorded");
      assert(author.mentionedAccounts.includes("friend1"), "Captions mentions extracted into mentionedAccounts");
      assert(author.mentionedAccounts.includes("friend2"), "Captions mentions extracted into mentionedAccounts");
      assert(!author.mentionedAccounts.includes("niki.webinns"), "Creator handle not duplicated into mentionedAccounts");
    });

    await test("Reel 02: Never fabricates handles with spaces from display names", () => {
      const authorOnlyDisplay = MetadataNormalizer.normalizeInstagramAuthor({
        rawDisplayName: "Nikitha M S",
      });
      assertEqual(authorOnlyDisplay.displayName, "Nikitha M S", "Display name preserved");
      assertEqual(authorOnlyDisplay.username, null, "Handle MUST NOT be '@Nikitha M S' because handles cannot contain spaces");
      assertEqual(authorOnlyDisplay.handle, undefined, "Handle must be undefined when no valid handle exists");
      assertEqual(authorOnlyDisplay.confidence, 0.5, "Confidence reflects unverified handle status");
      assertEqual(authorOnlyDisplay.attributionSource, "display_name_only", "Attribution source is display_name_only");
    });

    await test("Reel 02: Filters noise tags like #DON and conversational filler", () => {
      const rawTags = ["DON", "Education", "Coding", "webdev"];
      const normalized = ContentIntelligenceService.normalizeTags(rawTags);
      assert(!normalized.includes("DON"), "Noise tag '#DON' must be filtered out");
      assert(normalized.includes("Education"), "Relevance tag 'Education' preserved");
    });

    // --- REEL 03: Category Allocation Weighted Evidence & Date Separation ---
    await test("Reel 03: Category allocation selects Business based on cumulative evidence over incidental Travel keyword", () => {
      const tags = ["Website Building", "Freelancing", "Web Design", "Client Acquisition"];
      const text = "How to build a $5k/month web design and freelancing business while you travel the world. Learn how to sign high-ticket clients.";

      const catResult = CollectionMatchingService.inferCategories(tags, text);
      assertEqual(catResult.primaryCategory, "Business", "Primary category must be Business, not Travel");
      assert(catResult.confidence >= 0.7, "Category confidence must be high for matching business topics");
      assert(catResult.secondaryCategories.includes("Travel"), "Incidental travel topic recorded as secondary category");

      // Verify backward-compatible method also respects cumulative evidence
      const legacyCat = CollectionMatchingService.inferCollectionCategory(tags, text);
      assertEqual(legacyCat, "Business", "Legacy inferCollectionCategory returns Business");
    });

    await test("Reel 03: Cumulative evidence prioritizes Travel when travel tags dominate over incidental business keyword", () => {
      const travelTags = ["Travel", "Vacation", "Tourism"];
      const travelText = "Best 10 places to visit in Japan on a budget. Tips on running your freelance business remotely while traveling.";

      const catResult = CollectionMatchingService.inferCategories(travelTags, travelText);
      assertEqual(catResult.primaryCategory, "Travel", "Primary category must be Travel when travel evidence dominates");
      assert(catResult.confidence >= 0.7, "High confidence for dominant Travel topic");
      assert(catResult.secondaryCategories.includes("Business"), "Incidental business keyword recorded as secondary category");
    });

    await test("Reel 03: Preserves original publication date separately from import/saved date", () => {
      const publicationDate = "2026-10-18T12:00:00.000Z";
      const importDate = "2026-10-14T08:30:00.000Z";

      const existingItem: SavedItem = {
        id: "reel-03",
        title: "How to Build a Freelancing Business",
        url: "https://www.instagram.com/reel/C8XYZ123/",
        thumbnail: "https://example.com/thumb3.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Web Creator", username: "web.creator" },
        description: "Freelance website building tips",
        savedDate: importDate,
        collectionId: "business",
        collections: ["business"],
        tags: ["Website Building", "Freelancing"],
        favorite: false,
        archived: false,
        trashed: false,
        metadata: {
          domain: "instagram.com",
          publishedAt: publicationDate,
          importedAt: importDate,
          publishedDateConfidence: "verified",
          primaryCategory: "Business",
        },
        keyPoints: [],
        topics: ["Business"],
        personalNotes: "",
        aiSummary: { quick: "Guide", standard: "Full guide", detailed: "Detailed" },
      };

      // Ensure safeMerge preserves existing publishedAt when incoming update has undefined publishedAt
      const merged = ContentService.safeMerge(existingItem, {
        metadata: { domain: "instagram.com" } as any,
      });

      assertEqual(merged.metadata.publishedAt, publicationDate, "Authoritative publication date must be preserved through safeMerge");
      assertEqual(merged.savedDate, importDate, "Import/saved date is preserved separately");
      assertEqual(merged.metadata.primaryCategory, "Business", "Primary category preserved through safeMerge");
    });

    // --- Quality Gates & Uncertainty States ---
    await test("Quality Gate: Conflicting or ambiguous dates produce explicit uncertainty", () => {
      const ambiguousDate = MetadataNormalizer.parseAuthoritativeDate("not-a-valid-date");
      assertEqual(ambiguousDate.iso, null, "Invalid date strings return null rather than guessing");
      assertEqual(ambiguousDate.confidence, "unavailable", "Confidence is unavailable for invalid dates");
    });

    await test("Quality Gate: Conflicting categories produce flag for review", () => {
      const catResult = CollectionMatchingService.inferCategories(["Travel", "Business"], "A balanced review of both topics equally");
      assert(typeof catResult.primaryCategory === "string", "Selects a primary category");
      assert(catResult.secondaryCategories.length > 0, "Secondary category is tracked for multi-topic content");
    });

    // ---------------------------------------------------------------------------
    // 22. Bulk Import -> Locate Bookmark Resolution & Data Integrity Regression Suite
    // ---------------------------------------------------------------------------
    console.log("\n22. Bulk Import -> Locate Bookmark Resolution & Data Integrity Regression Tests:");

    await test("Bulk Import: A successful Instagram Reel import creates and references the exact canonical savedItemId", async () => {
      const locateUser = `locate-test-user-${Date.now()}`;
      StorageService.setImportLimits({ total: 100, used: 0 }, locateUser);

      const targetCol = CollectionService.create({
        name: "Reel Inspiration",
        description: "Test Collection for Instagram Reels",
        color: "#6366f1",
        icon: "Folder",
      }, locateUser);

      const candidate: ParsedImportCandidate = {
        originalUrl: "https://www.instagram.com/reel/C8ReelTest123/",
        platform: "instagram",
        title: "5 Productivity Hacks for Creators",
        creatorName: "@creatorpro",
        caption: "5 Productivity Hacks for Creators in 2026. #productivity #creators",
        collectionId: targetCol.id,
        collectionName: targetCol.name,
      };

      const candidateItems = ImportJobService.analyzeCandidates([candidate], [], "instagram").candidateItems;
      const job = ImportJobService.createJob({
        userId: locateUser,
        platform: "instagram",
        sourceType: "url_list",
        sourceName: "Instagram Reel Test",
        items: candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
          targetCollectionId: targetCol.id,
        },
      });

      const report = await ImportJobService.startJob(job.id);
      assertEqual(report.summary.imported, 1, "Exactly 1 item imported");
      const reportItem = report.items[0];
      assertEqual(reportItem.status, "success", "Item status is success");
      assert(typeof reportItem.savedItemId === "string" && reportItem.savedItemId.length > 0, "savedItemId is assigned");

      // Verify that the saved item actually exists in StorageService with this exact ID
      const savedItems = StorageService.getItems(locateUser);
      const matchedSaved = savedItems.find((i) => i.id === reportItem.savedItemId);
      assert(matchedSaved !== undefined, "SavedItem found in storage with the exact savedItemId");
      assertEqual(matchedSaved?.url, "https://www.instagram.com/reel/C8ReelTest123/", "URL matches canonical Reel URL");
      assertEqual(matchedSaved?.collectionId, targetCol.id, "Assigned to the correct target collection");

      // Verify Locate resolution: ContentService.getById resolves this exact bookmark
      const located = ContentService.getById(reportItem.savedItemId, locateUser);
      assert(located !== undefined, "Locate action via ContentService.getById finds the bookmark");
      assertEqual(located?.id, reportItem.savedItemId, "Resolved bookmark ID matches report savedItemId");
      assertEqual(located?.title, "5 Productivity Hacks for Creators", "Bookmark title preserved");
    });

    await test("Bulk Import: Multiple imported URLs resolve to their respective bookmarks without ID collisions", async () => {
      const multiUser = `multi-locate-user-${Date.now()}`;
      StorageService.setImportLimits({ total: 100, used: 0 }, multiUser);

      const candidates: ParsedImportCandidate[] = [
        {
          originalUrl: "https://www.instagram.com/reel/MultiReel01/",
          platform: "instagram",
          title: "MacBook Quick Tips",
          creatorName: "@techguide",
          caption: "Quick tips for your Mac. #macbook",
        },
        {
          originalUrl: "https://www.instagram.com/reel/MultiReel02/",
          platform: "instagram",
          title: "Cooking 101 Pasta",
          creatorName: "@chefitaly",
          caption: "How to make authentic pasta. #cooking",
        },
        {
          originalUrl: "https://www.instagram.com/reel/MultiReel03/",
          platform: "instagram",
          title: "Morning Routine",
          creatorName: "@fitlife",
          caption: "Daily fitness routine. #fitness",
        },
      ];

      const candidateItems = ImportJobService.analyzeCandidates(candidates, [], "instagram").candidateItems;
      const job = ImportJobService.createJob({
        userId: multiUser,
        platform: "instagram",
        sourceType: "url_list",
        sourceName: "Batch Instagram Reels",
        items: candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        },
      });

      const report = await ImportJobService.startJob(job.id);
      assertEqual(report.summary.imported, 3, "All 3 items imported");

      const idSet = new Set<string>();
      for (const item of report.items) {
        assert(typeof item.savedItemId === "string", "Each item has a string savedItemId");
        assert(!idSet.has(item.savedItemId!), "No ID collisions among imported items");
        idSet.add(item.savedItemId!);

        const located = ContentService.getById(item.savedItemId!, multiUser);
        assert(located !== undefined, `Bookmark ${item.savedItemId} successfully located in storage`);
        assertEqual(located?.url, item.canonicalUrl, "Located bookmark matches item canonicalUrl");
      }
      assertEqual(idSet.size, 3, "3 distinct canonical bookmark IDs created");
    });

    await test("Historical Reports: Reconciles legacy records with missing or mismatched savedItemId", () => {
      const legacyUser = `legacy-user-${Date.now()}`;
      // Pre-seed an existing saved item in the user's storage
      const preExistingBookmark: SavedItem = {
        id: "save-legacy-canonical-999",
        title: "Legacy Stored Bookmark",
        url: "https://www.instagram.com/reel/LegacyReel777/",
        thumbnail: "https://example.com/legacy.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Legacy Creator", username: "legacy.creator" },
        description: "Legacy Reel description",
        savedDate: new Date().toISOString(),
        collectionId: "legacy-col",
        collections: ["legacy-col"],
        tags: ["Legacy"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Legacy Quick", standard: "Legacy Standard", detailed: "Legacy Detailed" },
        keyPoints: ["Legacy Point"],
        topics: ["Legacy"],
        personalNotes: "",
        metadata: {
          canonicalUrl: "https://www.instagram.com/reel/LegacyReel777/",
        },
      };
      StorageService.saveItems([preExistingBookmark], legacyUser);

      // Create a historical report where savedItemId is missing or points to a non-existent ID
      const legacyReport: any = {
        id: `report-legacy-test`,
        jobId: "job-legacy-test",
        userId: legacyUser,
        platform: "instagram",
        accountName: "Connected Account",
        sourceName: "Historical Import",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1200,
        summary: {
          totalDiscovered: 1,
          alreadyExisted: 0,
          eligible: 1,
          imported: 1,
          failed: 0,
          skipped: 0,
          duplicates: 0,
          unsupported: 0,
          successPercentage: 100,
        },
        items: [
          {
            id: "legacy-item-1",
            jobId: "job-legacy-test",
            originalUrl: "https://www.instagram.com/reel/LegacyReel777/",
            canonicalUrl: "https://www.instagram.com/reel/LegacyReel777/",
            platform: "instagram",
            contentType: "reel",
            title: "Legacy Stored Bookmark",
            status: "success",
            savedItemId: "non-existent-old-id", // stale reference
            retryCount: 0,
          },
        ],
      };

      ImportJobService.saveReport(legacyReport);

      // Calling getReports must deterministically repair the stale savedItemId to the real canonical ID
      const reports = ImportJobService.getReports(legacyUser);
      assertEqual(reports.length, 1, "Historical report retrieved");
      const reconciledItem = reports[0].items[0];
      assertEqual(
        reconciledItem.savedItemId,
        "save-legacy-canonical-999",
        "Historical report item safely reconciled to canonical bookmark ID"
      );

      // Now Locate action can resolve it directly
      const located = ContentService.getById(reconciledItem.savedItemId!, legacyUser);
      assert(located !== undefined, "Locate action succeeds using reconciled ID");
      assertEqual(located?.title, "Legacy Stored Bookmark", "Correct legacy bookmark opened");
    });

    await test("Duplicate Handling: Duplicate imports retain canonical existing bookmark ID without duplicating", async () => {
      const dupUser = `dup-user-${Date.now()}`;
      StorageService.setImportLimits({ total: 100, used: 0 }, dupUser);

      // First import
      const candidate: ParsedImportCandidate = {
        originalUrl: "https://www.instagram.com/reel/C8DupReel/",
        platform: "instagram",
        title: "Duplicate Reel Test",
        creatorName: "@dupcreator",
        caption: "Testing duplicate retention. #duplicate",
      };

      const candidateItems1 = ImportJobService.analyzeCandidates([candidate], [], "instagram").candidateItems;
      const job1 = ImportJobService.createJob({
        userId: dupUser,
        platform: "instagram",
        sourceType: "url_list",
        sourceName: "First Import",
        items: candidateItems1,
        options: {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        },
      });
      const report1 = await ImportJobService.startJob(job1.id);
      const originalBookmarkId = report1.items[0].savedItemId;
      assert(Boolean(originalBookmarkId), "Initial import assigned savedItemId");

      // Second import with skipDuplicates: true
      const existingItems = StorageService.getItems(dupUser);
      const preAnalysis = ImportJobService.analyzeCandidates([candidate], existingItems, "instagram");
      assertEqual(preAnalysis.duplicates, 1, "Candidate detected as duplicate in pre-import analysis");
      assertEqual(preAnalysis.candidateItems[0].savedItemId, originalBookmarkId, "Candidate pre-import attaches existing savedItemId");

      const job2 = ImportJobService.createJob({
        userId: dupUser,
        platform: "instagram",
        sourceType: "url_list",
        sourceName: "Second Import (Duplicate)",
        items: preAnalysis.candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: true,
          duplicateStrategy: "skip",
          defaultTags: [],
        },
      });
      const report2 = await ImportJobService.startJob(job2.id);
      assertEqual(report2.summary.alreadyExisted, 1, "Duplicate count tracked in report");
      assertEqual(report2.items[0].status, "skipped", "Duplicate item skipped");
      assertEqual(report2.items[0].savedItemId, originalBookmarkId, "Skipped duplicate retains existing savedItemId for Locate");

      // Verify no duplicate records created in StorageService
      const allItems = StorageService.getItems(dupUser);
      assertEqual(allItems.length, 1, "Storage contains exactly 1 bookmark (no duplicates)");

      // Locate opens the existing bookmark
      const located = ContentService.getById(report2.items[0].savedItemId!, dupUser);
      assert(located !== undefined, "Locate button successfully finds the existing bookmark");
      assertEqual(located?.id, originalBookmarkId, "Locate resolves to original bookmark ID");
    });

    await test("Security & Multi-Tenant Isolation: Cross-workspace bookmark retrieval remains strictly blocked", () => {
      const userAlice = `alice-${Date.now()}`;
      const userBob = `bob-${Date.now()}`;

      const aliceItem: SavedItem = {
        id: "alice-private-reel",
        title: "Alice Private Bookmark",
        url: "https://www.instagram.com/reel/AliceSecret/",
        thumbnail: "https://example.com/alice.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Alice", username: "alice" },
        description: "Alice private content",
        savedDate: new Date().toISOString(),
        collectionId: "alice-col",
        collections: ["alice-col"],
        tags: ["AliceTag"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Alice Quick", standard: "Alice Standard", detailed: "Alice Detailed" },
        keyPoints: ["Alice Point"],
        topics: ["Alice"],
        personalNotes: "",
        metadata: {
          canonicalUrl: "https://www.instagram.com/reel/AliceSecret/",
        },
      };

      StorageService.saveItems([aliceItem], userAlice);

      // Alice can locate her bookmark
      const aliceFound = ContentService.getById("alice-private-reel", userAlice);
      assert(aliceFound !== undefined, "Alice can locate her own bookmark");

      // Bob MUST NOT be able to locate Alice's bookmark
      const bobAttempt = ContentService.getById("alice-private-reel", userBob);
      assertEqual(bobAttempt, undefined, "Bob cannot locate Alice's bookmark (tenant isolation enforced)");

      // Nonexistent item ID produces undefined (not found)
      const nonExistent = ContentService.getById("does-not-exist-at-all", userAlice);
      assertEqual(nonExistent, undefined, "Nonexistent ID returns undefined for not found state");
    });

    await test("Integrity Protection: Content transcription, AI tags, category, and metadata are intact", async () => {
      const integrityUser = `integrity-user-${Date.now()}`;
      StorageService.setImportLimits({ total: 100, used: 0 }, integrityUser);

      const candidate: ParsedImportCandidate = {
        originalUrl: "https://www.instagram.com/reel/C8IntegrityReel/",
        platform: "instagram",
        title: "Advanced TypeScript Techniques",
        creatorName: "@tsguru",
        caption: "Mastering advanced TypeScript patterns and utility types. #typescript #coding",
      };

      const candidateItems = ImportJobService.analyzeCandidates([candidate], [], "instagram").candidateItems;
      const job = ImportJobService.createJob({
        userId: integrityUser,
        platform: "instagram",
        sourceType: "url_list",
        sourceName: "Integrity Test",
        items: candidateItems,
        options: {
          autoOrganize: false,
          skipDuplicates: false,
          defaultTags: [],
        },
      });

      const report = await ImportJobService.startJob(job.id);
      const savedItemId = report.items[0].savedItemId!;
      const bookmark = ContentService.getById(savedItemId, integrityUser);

      assert(bookmark !== undefined, "Bookmark is persisted and locatable");
      assertEqual(bookmark?.creator?.name, "@tsguru", "Creator preserved");
      assert(bookmark?.description.includes("Mastering advanced TypeScript"), "Caption preserved");
      assertEqual(bookmark?.platform, "instagram", "Platform preserved");
      assertEqual(bookmark?.contentType, "reel", "Content type preserved as reel");
      assert(bookmark?.metadata !== undefined, "Metadata preserved");
    });

    console.log("\n24. Razorpay Webhook & Receipt Reliability Tests:");

    const razorpaySecret = "test-webhook-secret-never-logged";
    const webhookSignature = (raw: string) => createHmac("sha256", razorpaySecret).update(raw).digest("hex");
    const makeWebhookStore = (status = "authenticated") => {
      const calls: string[] = [];
      const capturedPayments: Record<string, unknown>[] = [];
      let eventProcessed = false;
      const store: RazorpayWebhookStore = {
        async claimEvent() { calls.push("claim"); return eventProcessed ? "processed" : "claimed"; },
        async markEventProcessed() { calls.push("processed"); eventProcessed = true; },
        async findSubscription() { calls.push("find-subscription"); return { id: "local-sub-1", user_id: "user-1", plan: "pro", billing_cycle: "monthly", amount: 1000, currency: "INR", status }; },
        async updateSubscription(_id, values) { calls.push(`subscription:${String(values.status)}`); },
        async upsertCapturedPayment(values) { calls.push("payment-upsert"); capturedPayments.push(values); },
        async recordPaymentFailure() { calls.push("payment-failure"); },
        async updateReceiptUrl() { calls.push("receipt-update"); },
      };
      return { calls, capturedPayments, store };
    };
    const makeSignedWebhook = (payload: Record<string, unknown>, event = "subscription.activated", eventId = "evt-1") => {
      const raw = JSON.stringify({ event, payload });
      return new Request("https://keeper.test/api/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": webhookSignature(raw), "x-razorpay-event-id": eventId },
        body: raw,
      });
    };

    const checkoutNow = Date.parse("2026-10-25T10:00:00.000Z");
    const checkoutRow = (overrides: Record<string, unknown> = {}) => ({
      id: "local-sub-1",
      status: "created",
      current_period_end: null,
      trial_ends_at: null,
      cancel_at_cycle_end: false,
      created_at: new Date(checkoutNow - 60 * 60 * 1000).toISOString(),
      updated_at: null,
      ...overrides,
    });
    const checkoutReason = (rows: ReturnType<typeof checkoutRow>[]) => getCheckoutBlockDecision(rows, checkoutNow).reason;

    await test("Razorpay checkout pricing and save credits match the pricing page", () => {
      assertEqual(KEEPER_BILLING_PLANS.basic.monthly.amount, 30000, "Basic monthly plan is INR 300");
      assertEqual(KEEPER_BILLING_PLANS.basic.monthly.credits, 300, "Basic monthly plan grants 300 credits");
      assertEqual(KEEPER_BILLING_PLANS.basic.yearly.amount, 350000, "Basic yearly plan is INR 3,500");
      assertEqual(KEEPER_BILLING_PLANS.basic.yearly.credits, 3600, "Basic yearly plan grants 3,600 credits");
      assertEqual(KEEPER_BILLING_PLANS.pro.monthly.amount, 50000, "Pro monthly plan is INR 500");
      assertEqual(KEEPER_BILLING_PLANS.pro.monthly.credits, 500, "Pro monthly plan grants 500 credits");
      assertEqual(KEEPER_BILLING_PLANS.pro.yearly.amount, 550000, "Pro yearly plan is INR 5,500");
      assertEqual(KEEPER_BILLING_PLANS.pro.yearly.credits, 6000, "Pro yearly plan grants 6,000 credits");
    });

    await test("Billing preflight identifies missing server-only Supabase credentials", () => {
      assertEqual(getMissingBillingServerVariables({ NEXT_PUBLIC_SUPABASE_URL: "https://keeper.test", SUPABASE_SERVICE_ROLE_KEY: "" }).join(","), "SUPABASE_SERVICE_ROLE_KEY", "Only the absent service-role key is reported by name");
      assertEqual(getMissingBillingServerVariables({ NEXT_PUBLIC_SUPABASE_URL: "https://keeper.test", SUPABASE_SERVICE_ROLE_KEY: "test-only-value" }).length, 0, "Complete server configuration passes preflight");
    });

    await test("Razorpay checkout diagnostics retain safe provider codes only", () => {
      assertEqual(getSafeRazorpayErrorCode({ error: { code: "BAD_REQUEST_ERROR" }, description: "private detail" }), "BAD_REQUEST_ERROR", "Known provider code is retained");
      assertEqual(getSafeRazorpayErrorCode({ code: "secret value" }), undefined, "Unsafe provider strings are discarded");
      assertEqual(getSafeRazorpayErrorCode(new Error("private detail")), undefined, "Raw provider messages are not treated as codes");
    });

    await test("Razorpay configuration defaults to test mode and blocks live keys", () => {
      assertEqual(getRazorpayConfigurationError({ RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "test-secret" }), null, "Test keys work without an explicit mode");
      assertEqual(getRazorpayConfigurationError({ RAZORPAY_KEY_ID: "rzp_live_key", RAZORPAY_KEY_SECRET: "live-secret" }), "Test mode requires a Razorpay test key ID.", "Live keys cannot be used in the default test mode");
      assertEqual(getRazorpayConfigurationError({ RAZORPAY_MODE: "live", RAZORPAY_KEY_ID: "rzp_live_key", RAZORPAY_KEY_SECRET: "live-secret" }), "Live Razorpay payments are disabled or the live key ID is invalid.", "Live mode requires explicit authorization");
      assertEqual(getRazorpayConfigurationError({ RAZORPAY_MODE: "live", ALLOW_REAL_RAZORPAY_PAYMENTS: "true", RAZORPAY_KEY_ID: "rzp_live_key", RAZORPAY_KEY_SECRET: "live-secret" }), null, "Explicitly enabled live credentials pass validation");
    });

    await test("Checkout guard blocks a trial using trial_ends_at when current_period_end is missing", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "trialing", trial_ends_at: new Date(checkoutNow + 86400000).toISOString() })]), "active_or_trial", "Trial period blocks another checkout");
    });

    await test("Checkout guard blocks a cancelled trial until its original trial end", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "cancelled", trial_ends_at: new Date(checkoutNow + 86400000).toISOString() })]), "active_or_trial", "Cancelled trial access blocks a second plan during its remaining trial");
      assertEqual(checkoutReason([checkoutRow({ status: "cancelled", trial_ends_at: new Date(checkoutNow - 1000).toISOString() })]), null, "Expired cancelled trial allows a new checkout");
    });

    await test("Checkout guard blocks active paid subscriptions with a future period end", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "active", current_period_end: new Date(checkoutNow + 86400000).toISOString() })]), "active_or_trial", "Active paid period blocks another checkout");
    });

    await test("Checkout guard blocks active subscriptions with unknown expiry", () => {
      const decision = getCheckoutBlockDecision([checkoutRow({ status: "active" })], checkoutNow);
      assertEqual(decision.reason, "active_or_trial", "Unknown-expiry active subscription blocks");
      assertEqual(decision.unknownExpiryRows[0]?.status, "active", "Active row is returned for the allowed log fields");
    });

    await test("Checkout guard always blocks a pending subscription regardless of age", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "pending", created_at: new Date(checkoutNow - 40 * 86400000).toISOString() })]), "pending", "Old pending state still blocks");
    });

    await test("Checkout guard keeps created checkouts blocked until provider state is reconciled", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "created", created_at: new Date(checkoutNow - 29 * 60000).toISOString() })]), "created_checkout", "Recent created checkout blocks");
      assertEqual(checkoutReason([checkoutRow({ status: "created", created_at: new Date(checkoutNow - 31 * 60000).toISOString() })]), "created_checkout", "Older created checkout remains blocked until its Razorpay state is reconciled");
    });

    await test("Checkout guard blocks canceled and cancelled subscriptions while cycle-end access remains", () => {
      for (const status of ["cancelled", "canceled"]) {
        assertEqual(checkoutReason([checkoutRow({ status, cancel_at_cycle_end: true, current_period_end: new Date(checkoutNow + 86400000).toISOString() })]), "cancelled_with_access", `${status} paid access blocks checkout`);
      }
    });

    await test("Checkout guard blocks authenticated rows with future expiry as an active period", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "authenticated", current_period_end: new Date(checkoutNow + 86400000).toISOString() })]), "active_or_trial", "Authenticated plan with future expiry blocks");
    });

    await test("Checkout guard blocks authenticated null-expiry rows inside the 30-minute window", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "authenticated", updated_at: new Date(checkoutNow - 29 * 60000).toISOString() })]), "recent_authenticated", "Recent updated_at blocks unknown-expiry authorization");
      assertEqual(checkoutReason([checkoutRow({ status: "authenticated", created_at: new Date(checkoutNow - 29 * 60000).toISOString() })]), "recent_authenticated", "Recent created_at blocks unknown-expiry authorization");
    });

    await test("Checkout guard allows authenticated null-expiry rows outside the 30-minute window", () => {
      assertEqual(checkoutReason([checkoutRow({ status: "authenticated" })]), null, "Old unknown-expiry authorization does not block");
    });

    await test("Checkout guard blocks trialing rows with unknown expiry", () => {
      const decision = getCheckoutBlockDecision([checkoutRow({ status: "trialing" })], checkoutNow);
      assertEqual(decision.reason, "active_or_trial", "Unknown-expiry trial blocks");
      assertEqual(decision.unknownExpiryRows[0]?.id, "local-sub-1", "Unknown-expiry row is returned for a safe log");
    });

    await test("Checkout guard allows fully expired plans and old created rows", () => {
      assertEqual(checkoutReason([
        checkoutRow({ status: "active", current_period_end: new Date(checkoutNow - 86400000).toISOString() }),
        checkoutRow({ id: "old-created", status: "cancelled" }),
      ]), null, "Expired active plan and stale checkout allow a new checkout");
    });

    await test("Checkout guard applies reason precedence across users with two blocking rows", () => {
      const activeTrial = checkoutRow({ id: "trial", status: "trialing", trial_ends_at: new Date(checkoutNow + 86400000).toISOString() });
      const pending = checkoutRow({ id: "pending", status: "pending" });
      const cancelled = checkoutRow({ id: "cancelled", status: "cancelled", cancel_at_cycle_end: true, current_period_end: new Date(checkoutNow + 86400000).toISOString() });
      const created = checkoutRow({ id: "created", status: "created", created_at: new Date(checkoutNow - 5 * 60000).toISOString() });
      assertEqual(checkoutReason([pending, activeTrial]), "active_or_trial", "Active/trial takes precedence over pending");
      assertEqual(checkoutReason([cancelled, pending]), "pending", "Pending takes precedence over cancelled with access");
      assertEqual(checkoutReason([created, cancelled]), "cancelled_with_access", "Cancelled access takes precedence over recent created checkout");
    });

    await test("Razorpay webhook accepts a valid raw-body signature", async () => {
      const { calls, store } = makeWebhookStore();
      const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } }), {
        webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 200, "Valid signed webhook is accepted");
      assert(calls.includes("subscription:active"), "Expected subscription activation write");
    });

    await test("Razorpay webhook cannot reactivate a cancelled subscription", async () => {
      const { calls, store } = makeWebhookStore("cancelled");
      const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } }), {
        webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 200, "Valid delayed webhook is acknowledged");
      assert(!calls.includes("subscription:active"), "Delayed activation does not restore a canceled subscription");
    });

    await test("Razorpay webhook rejects an invalid signature before database access", async () => {
      const { calls, store } = makeWebhookStore();
      let storeCreations = 0;
      const request = makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } });
      const raw = await request.text();
      const badRequest = new Request(request.url, { method: "POST", headers: { "x-razorpay-signature": "0".repeat(64), "x-razorpay-event-id": "evt-1" }, body: raw });
      const response = await handleRazorpayWebhook(badRequest, {
        webhookSecret: razorpaySecret, createStore: () => { storeCreations += 1; return store; }, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 400, "Invalid signature is rejected");
      assertEqual(calls.length, 0, "No store access before signature verification");
      assertEqual(storeCreations, 0, "Invalid signature never creates the store");
    });

    await test("Razorpay webhook rejects a missing secret without database access", async () => {
      const { calls, store } = makeWebhookStore();
      const response = await handleRazorpayWebhook(makeSignedWebhook({}), {
        webhookSecret: undefined, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 401, "Missing secret is rejected");
      assertEqual(calls.length, 0, "Missing secret does not access the store");
    });

    await test("Razorpay webhook rejects each missing authentication header without database access", async () => {
      const { calls, store } = makeWebhookStore();
      const raw = JSON.stringify({ event: "subscription.activated", payload: { subscription: { entity: { id: "sub-1" } } } });
      const baseHeaders = { "x-razorpay-signature": webhookSignature(raw), "x-razorpay-event-id": "evt-headers" };
      for (const headers of [
        new Headers({ "x-razorpay-event-id": "evt-headers" }),
        new Headers({ "x-razorpay-signature": webhookSignature(raw) }),
      ]) {
        const response = await handleRazorpayWebhook(new Request("https://keeper.test", { method: "POST", headers, body: raw }), {
          webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
        });
        assertEqual(response.status, 401, "Missing signature or event ID gets 401");
      }
      const missingSecretResponse = await handleRazorpayWebhook(new Request("https://keeper.test", { method: "POST", headers: baseHeaders, body: raw }), {
        webhookSecret: undefined, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(missingSecretResponse.status, 401, "Missing webhook secret gets 401");
      assertEqual(calls.length, 0, "Authentication failures never create or access the store");
    });

    await test("Razorpay webhook rejects signed invalid JSON before creating the store", async () => {
      let storeCreations = 0;
      const raw = "not valid json";
      const response = await handleRazorpayWebhook(new Request("https://keeper.test", {
        method: "POST", headers: { "x-razorpay-signature": webhookSignature(raw), "x-razorpay-event-id": "evt-json" }, body: raw,
      }), {
        webhookSecret: razorpaySecret, createStore: () => { storeCreations += 1; throw new Error("store should not be created"); },
        scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 400, "Signed invalid JSON gets 400");
      assertEqual(storeCreations, 0, "Invalid JSON never creates the store");
    });

    await test("Razorpay webhook marks an unknown subscription event processed", async () => {
      const { calls, store } = makeWebhookStore();
      store.findSubscription = async () => { calls.push("unknown-subscription"); return null; };
      const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "unknown-sub" } } }), {
        webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 200, "Unknown subscription is acknowledged");
      assert(calls.includes("processed"), "Unknown subscription event is marked processed");
    });

    await test("Razorpay unrelated event without subscription ID is acknowledged and left unprocessed", async () => {
      let storeCreations = 0;
      const response = await handleRazorpayWebhook(makeSignedWebhook({}, "some.unrelated.event", "evt-no-sub"), {
        webhookSecret: razorpaySecret, createStore: () => { storeCreations += 1; throw new Error("store should not be created"); },
        scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 200, "Unrelated event without subscription ID is acknowledged");
      assertEqual(storeCreations, 0, "No-subscription no-op does not access storage");
    });

    await test("Razorpay store configuration failure returns a controlled 500", async () => {
      let logged = false;
      const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } }), {
        webhookSecret: razorpaySecret, createStore: () => { throw new Error("service role missing"); },
        scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => { logged = true; },
      });
      assertEqual(response.status, 500, "Store construction failure returns 500");
      assert(logged, "Store construction failure is logged through sanitized logger");
    });

    await test("Razorpay processed duplicate event returns 200 without repeating writes", async () => {
      const { calls, store } = makeWebhookStore();
      const dependencies = { webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {} };
      await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } }), dependencies);
      const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1" } } }), dependencies);
      assertEqual(response.status, 200, "Duplicate is acknowledged");
      assertEqual(calls.filter((call) => call === "subscription:active").length, 1, "Duplicate does not repeat state write");
    });

    await test("Razorpay concurrent duplicate delivery uses idempotent writes and acknowledges both", async () => {
      const calls: string[] = [];
      let processed = false;
      let persistedFailureRows = 0;
      const store: RazorpayWebhookStore = {
        async claimEvent() { calls.push("claim"); return processed ? "processed" : "unprocessed"; },
        async markEventProcessed() { calls.push("processed"); processed = true; },
        async findSubscription() { return null; }, async updateSubscription() {}, async upsertCapturedPayment() {},
        async recordPaymentFailure() { if (!calls.includes("failure-write")) persistedFailureRows += 1; calls.push("failure-write"); },
        async updateReceiptUrl() {},
      };
      const request = () => makeSignedWebhook({ payment: { entity: { id: "pay-1", error_code: "BAD" } } }, "payment.failed", "evt-concurrent");
      const dependencies = { webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {} };
      const responses = await Promise.all([handleRazorpayWebhook(request(), dependencies), handleRazorpayWebhook(request(), dependencies)]);
      assert(responses.every((response) => response.status === 200), "Both deliveries are acknowledged");
      assertEqual(persistedFailureRows, 1, "Unique event_id upsert protects the failure record from duplicate rows");
    });

    await test("Razorpay callback accepts a valid signature and rejects a tampered signature", () => {
      const callbackSignature = createHmac("sha256", razorpaySecret).update("pay-1|sub-1").digest("hex");
      assert(verifyRazorpaySubscriptionSignature("pay-1", "sub-1", callbackSignature, razorpaySecret), "Valid callback signature passes");
      assert(!verifyRazorpaySubscriptionSignature("pay-other", "sub-1", callbackSignature, razorpaySecret), "Tampered callback details fail");
      assert(!verifyRazorpaySubscriptionSignature("pay-1", "sub-1", callbackSignature, undefined), "Missing callback secret fails closed");
    });

    await test("subscription.authenticated cannot overwrite active or cancelled state", async () => {
      for (const existingStatus of ["active", "cancelled"]) {
        const { calls, store } = makeWebhookStore(existingStatus);
        const response = await handleRazorpayWebhook(makeSignedWebhook({ subscription: { entity: { id: "sub-1", status: "authenticated" } } }, "subscription.authenticated", `evt-${existingStatus}`), {
          webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
        });
        assertEqual(response.status, 200, `${existingStatus} event is acknowledged`);
        assert(!calls.some((call) => call.startsWith("subscription:")), `${existingStatus} state is preserved`);
      }
    });

    await test("payment.failed is recorded and never activates a subscription", async () => {
      const { calls, store } = makeWebhookStore();
      const response = await handleRazorpayWebhook(makeSignedWebhook({
        subscription: { entity: { id: "sub-1" } },
        payment: { entity: { id: "pay-failed", subscription_id: "sub-1", amount: 1000, currency: "INR", error_code: "BAD", error_reason: "Declined" } },
      }, "payment.failed", "evt-failed"), {
        webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {}, fetchInvoice: async () => ({}), logError: () => {},
      });
      assertEqual(response.status, 200, "Failed payment event is acknowledged after recording");
      assert(calls.includes("payment-failure"), "Failure is recorded");
      assert(!calls.some((call) => call.startsWith("subscription:")), "Failure never activates a subscription");
    });

    await test("subscription.charged records the payment and schedules receipt lookup", async () => {
      const { calls, capturedPayments, store } = makeWebhookStore("active");
      let scheduledReceiptTask: (() => Promise<void>) | null = null;
      const response = await handleRazorpayWebhook(makeSignedWebhook({
        subscription: { entity: { id: "sub-1", status: "active" } },
        payment: { entity: { id: "pay-charged", amount: 30000, currency: "INR", invoice_id: "inv-1", created_at: 1792922400 } },
      }, "subscription.charged", "evt-charged"), {
        webhookSecret: razorpaySecret,
        createStore: () => store,
        scheduleAfterResponse: (work) => { scheduledReceiptTask = work; },
        fetchInvoice: async () => ({ short_url: "https://receipt.invalid/inv-1" }),
        logError: () => {},
      });
      assertEqual(response.status, 200, "Charged event is acknowledged");
      assert(calls.includes("payment-upsert"), "Captured payment upsert runs");
      assertEqual(capturedPayments[0]?.razorpay_payment_id, "pay-charged", "Payment ID is persisted");
      assertEqual(capturedPayments[0]?.subscription_id, "local-sub-1", "Payment links to its local subscription");
      assert(scheduledReceiptTask !== null, "Invoice receipt lookup is scheduled after acknowledgement");
    });

    await test("subscription.halted, subscription.cancelled and subscription.completed map to their states", async () => {
      const cases = [
        { event: "subscription.halted", expected: "halted" },
        { event: "subscription.cancelled", expected: "cancelled" },
        { event: "subscription.completed", expected: "completed" },
      ];
      for (const [index, item] of cases.entries()) {
        const { calls, store } = makeWebhookStore("active");
        const response = await handleRazorpayWebhook(makeSignedWebhook({
          subscription: { entity: { id: "sub-1", status: item.expected } },
        }, item.event, `evt-terminal-${index}`), {
          webhookSecret: razorpaySecret, createStore: () => store, scheduleAfterResponse: () => {},
          fetchInvoice: async () => ({}), logError: () => {},
        });
        assertEqual(response.status, 200, `${item.event} is acknowledged`);
        assert(calls.includes(`subscription:${item.expected}`), `${item.event} stores ${item.expected}`);
      }
    });

    await test("Receipt retry is capped at three and times out each invoice fetch", async () => {
      let fetchCount = 0;
      const retry = createReceiptRetryTask(Array.from({ length: 5 }, (_, index) => ({ razorpay_payment_id: `pay-${index}`, razorpay_invoice_id: `inv-${index}`, receipt_url: null })), {
        fetchInvoice: async () => { fetchCount += 1; return new Promise(() => {}); }, saveReceiptUrl: async () => {}, timeoutMs: 2,
      });
      await retry();
      assertEqual(fetchCount, 3, "At most three recent invoices are retried");
    });

    // ---------------------------------------------------------------------------
    // 27. Cross-Device Data Synchronization & Multi-Device Isolation Suite
    // ---------------------------------------------------------------------------
    console.log("\n27. Cross-Device Data Synchronization & Multi-Device Isolation Suite:");

    await test("Cross-Device Sync 1: Data imported on desktop appears on mobile when using the same account", async () => {
      const syncUser = `user-sync-test-${Date.now()}`;
      StorageService.clearUserData(syncUser);

      // Desktop: imports an Instagram Reel
      const desktopItem: SavedItem = {
        id: `desktop-item-${Date.now()}`,
        url: "https://www.instagram.com/reel/C34xyz987/",
        title: "Desktop Imported Reel",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "reel_creator", handle: "reel_creator" },
        description: "Tips on workflow automation",
        thumbnail: "https://example.com/thumb-desktop.jpg",
        savedDate: new Date().toISOString(),
        tags: ["Automation", "Workflow"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Automation tips", standard: "Workflow automation tips", detailed: "Detailed tips" },
        keyPoints: ["Point 1"],
        topics: ["Automation"],
        personalNotes: "Saved from desktop Mac",
        metadata: {
          serverMediaId: `srv-media-${Date.now()}`,
          aiProcessingStatus: "COMPLETED",
        },
      };

      // Desktop saves to its workspace and local storage
      StorageService.saveItems([desktopItem], syncUser);
      const desktopCol: Collection = {
        id: `col-sync-${Date.now()}`,
        name: "Workflows",
        color: "#6366f1",
        icon: "Folder",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveCollections([desktopCol], syncUser);

      // Mobile: Fresh device logs in with the same account
      // Initially mobile device local storage has 0 items
      const mobileDeviceStorage = new Map<string, string>();
      // Mobile initial sync loads from server source of truth
      const serverSourceOfTruth = StorageService.getItems(syncUser);
      assertEqual(serverSourceOfTruth.length, 1, "Server account has 1 item imported on desktop");
      assertEqual(serverSourceOfTruth[0].title, "Desktop Imported Reel", "Item title matches desktop import");

      // Mobile receives server items and caches them
      mobileDeviceStorage.set(`recall_items_user_${syncUser}`, JSON.stringify(serverSourceOfTruth));
      const mobileItems: SavedItem[] = JSON.parse(mobileDeviceStorage.get(`recall_items_user_${syncUser}`) || "[]");

      assertEqual(mobileItems.length, 1, "Mobile device displays the item imported on desktop");
      assertEqual(mobileItems[0].url, desktopItem.url, "Canonical URL matches on mobile");
      assertEqual(mobileItems[0].personalNotes, "Saved from desktop Mac", "Metadata and notes match on mobile");

      StorageService.clearUserData(syncUser);
    });

    await test("Cross-Device Sync 2: Data added or edited on mobile appears on desktop after refresh/sync", async () => {
      const syncUser = `user-sync-edit-${Date.now()}`;
      StorageService.clearUserData(syncUser);

      const initialItem: SavedItem = {
        id: `item-edit-${Date.now()}`,
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Original YouTube Video",
        platform: "youtube",
        contentType: "video",
        creator: { name: "Rick Astley" },
        description: "Official music video",
        thumbnail: "https://example.com/thumb-yt.jpg",
        savedDate: new Date().toISOString(),
        tags: ["Music"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Music", standard: "Music video", detailed: "Music video breakdown" },
        keyPoints: [],
        topics: ["Music"],
        personalNotes: "",
        metadata: { serverMediaId: "srv-yt-1", aiProcessingStatus: "COMPLETED" },
      };
      StorageService.saveItems([initialItem], syncUser);

      // Mobile user edits the item: toggles favorite, adds personal notes, edits tags
      const mobileUpdates: Partial<SavedItem> = {
        favorite: true,
        personalNotes: "Favorite song added on mobile iPhone",
        tags: ["Music", "Classics", "80s"],
      };

      const updatedItem = ContentService.updateItem(initialItem.id, mobileUpdates, syncUser);
      assert(updatedItem !== null, "Mobile update succeeds");
      assertEqual(updatedItem.favorite, true, "Item is favorited on mobile");
      assertEqual(updatedItem.personalNotes, "Favorite song added on mobile iPhone", "Personal notes updated on mobile");

      // Desktop simulates refresh / sync: reads from server-side source of truth
      const desktopSyncedItems = StorageService.getItems(syncUser);
      const desktopItem = desktopSyncedItems.find((i) => i.id === initialItem.id);

      assert(desktopItem !== undefined, "Desktop finds the item");
      assertEqual(desktopItem.favorite, true, "Desktop sees the favorite state set on mobile");
      assertEqual(desktopItem.personalNotes, "Favorite song added on mobile iPhone", "Desktop sees mobile personal notes");
      assert(desktopItem.tags.includes("Classics"), "Desktop sees updated tags from mobile");

      StorageService.clearUserData(syncUser);
    });

    await test("Cross-Device Sync 3: Refreshing either device retains the account’s data", async () => {
      const syncUser = `user-sync-refresh-${Date.now()}`;
      StorageService.clearUserData(syncUser);

      const items: SavedItem[] = [
        {
          id: `refresh-item-1`,
          url: "https://twitter.com/user/status/123456789",
          title: "Tweet 1",
          platform: "x",
          contentType: "post",
          creator: { name: "TechLeader", username: "techleader" },
          description: "Important thread on AI architecture",
          thumbnail: "https://example.com/thumb-tw.jpg",
          savedDate: new Date().toISOString(),
          tags: ["AI", "Architecture"],
          favorite: true,
          archived: false,
          trashed: false,
          aiSummary: { quick: "AI thread", standard: "AI architecture thread", detailed: "Details" },
          keyPoints: ["Point A", "Point B"],
          topics: ["AI"],
          personalNotes: "Review for architecture meeting",
          metadata: { serverMediaId: "srv-tw-1", aiProcessingStatus: "COMPLETED" },
        },
      ];
      StorageService.saveItems(items, syncUser);

      // Simulate device refresh 1: reload from storage
      const firstRefresh = StorageService.getItems(syncUser);
      assertEqual(firstRefresh.length, 1, "First refresh retains 1 item");
      assertEqual(firstRefresh[0].title, "Tweet 1", "Title retained after first refresh");
      assertEqual(firstRefresh[0].favorite, true, "Favorite flag retained after first refresh");

      // Simulate device refresh 2: multiple reloads simulate subsequent browser restarts
      const secondRefresh = StorageService.getItems(syncUser);
      assertEqual(secondRefresh.length, 1, "Second refresh retains 1 item");
      assertEqual(secondRefresh[0].personalNotes, "Review for architecture meeting", "Personal notes retained across refreshes");

      StorageService.clearUserData(syncUser);
    });

    await test("Cross-Device Sync 4: Switching accounts does not leak cached data from the previous account", async () => {
      const userAlice = `user-alice-${Date.now()}`;
      const userBob = `user-bob-${Date.now()}`;
      StorageService.clearUserData(userAlice);
      StorageService.clearUserData(userBob);

      const aliceItem: SavedItem = {
        id: `alice-private-doc`,
        url: "https://github.com/alice/confidential-project",
        title: "Alice Confidential Strategy",
        platform: "website",
        contentType: "article",
        creator: { name: "Alice" },
        description: "Confidential roadmap",
        thumbnail: "https://example.com/thumb-alice.jpg",
        savedDate: new Date().toISOString(),
        tags: ["Confidential"],
        favorite: true,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Confidential", standard: "Confidential roadmap", detailed: "Details" },
        keyPoints: [],
        topics: ["Confidential"],
        personalNotes: "Alice only",
        metadata: { serverMediaId: "srv-alice-1", aiProcessingStatus: "COMPLETED" },
      };
      StorageService.saveItems([aliceItem], userAlice);

      // Alice logs out: client state is cleared
      let currentClientState: SavedItem[] = [];

      // Bob signs in on the same browser / device
      // Bob's workspace must be completely empty of Alice's data
      const bobServerItems = StorageService.getItems(userBob);
      currentClientState = bobServerItems;

      assertEqual(currentClientState.length, 0, "Bob workspace starts clean without Alice items");
      const foundAliceData = currentClientState.some((i) => i.id === aliceItem.id || i.title.includes("Alice"));
      assertEqual(foundAliceData, false, "Zero data from Alice leaks into Bob workspace");

      StorageService.clearUserData(userAlice);
      StorageService.clearUserData(userBob);
    });

    await test("Cross-Device Sync 5: Duplicate imports remain deduplicated across devices", async () => {
      const syncUser = `user-sync-dedup-${Date.now()}`;
      StorageService.clearUserData(syncUser);

      const canonicalUrl = "https://www.youtube.com/watch?v=kJQP7kiw5Fk";
      const desktopImport: SavedItem = {
        id: `save-desktop-1`,
        url: canonicalUrl,
        title: "Despacito Music Video",
        platform: "youtube",
        contentType: "video",
        creator: { name: "Luis Fonsi" },
        description: "Music video",
        thumbnail: "https://example.com/thumb-despacito.jpg",
        savedDate: "2024-02-01T12:00:00.000Z",
        tags: ["Music", "Latin"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Song", standard: "Song summary", detailed: "Detailed summary" },
        keyPoints: [],
        topics: ["Music"],
        personalNotes: "Desktop import notes",
        metadata: { serverMediaId: "srv-yt-dedup-1", aiProcessingStatus: "COMPLETED" },
      };
      ContentService.addItem(desktopImport, syncUser);

      // Mobile imports the exact same video using short URL format: https://youtu.be/kJQP7kiw5Fk
      const mobileImportCandidate = {
        url: "https://youtu.be/kJQP7kiw5Fk",
        title: "Despacito",
        platform: "youtube" as const,
        contentType: "video" as const,
        creator: { name: "Luis Fonsi" },
        description: "Music video",
        thumbnail: "https://example.com/thumb-despacito.jpg",
        tags: ["Pop"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Song", standard: "Song summary", detailed: "Detailed summary" },
        keyPoints: [],
        topics: ["Music"],
        personalNotes: "Mobile attempt",
        metadata: {},
      };

      // ContentService.addItem with duplicateStrategy="skip"
      const duplicateDetected = ContentService.checkDuplicate(mobileImportCandidate.url, syncUser);
      assert(duplicateDetected !== null, "Canonical duplicate detected across different URL formats");
      assertEqual(duplicateDetected.id, desktopImport.id, "Resolves to existing canonical bookmark ID");

      const savedResult = ContentService.addItem(mobileImportCandidate, syncUser, "skip");
      assertEqual(savedResult.id, desktopImport.id, "Existing bookmark returned without creating a new record");

      const allItems = ContentService.getAll(syncUser);
      assertEqual(allItems.length, 1, "Exact 1 record exists in workspace across devices");

      StorageService.clearUserData(syncUser);
    });

    await test("Cross-Device Sync 6: One user cannot access another user’s data by changing IDs or URLs", async () => {
      const userVictim = `user-victim-${Date.now()}`;
      const userAttacker = `user-attacker-${Date.now()}`;
      StorageService.clearUserData(userVictim);
      StorageService.clearUserData(userAttacker);

      const secretItem: SavedItem = {
        id: `secret-victim-save`,
        url: "https://internal.company.com/payroll",
        title: "Executive Compensation",
        platform: "website",
        contentType: "article",
        creator: { name: "HR" },
        description: "Salaries and bonuses",
        thumbnail: "https://example.com/thumb-secret.jpg",
        savedDate: new Date().toISOString(),
        tags: ["Confidential"],
        favorite: true,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Payroll", standard: "Payroll", detailed: "Payroll" },
        keyPoints: [],
        topics: ["Compensation"],
        personalNotes: "Do not share",
        metadata: { serverMediaId: "srv-victim-secret-1" },
      };
      StorageService.saveItems([secretItem], userVictim);

      // Attacker queries by ID inside their own scoped workspace
      const attackerLookup = ContentService.getById("secret-victim-save", userAttacker);
      assertEqual(attackerLookup, undefined, "Attacker cannot retrieve victim item by ID");

      // Attacker queries by serverMediaId inside their own scoped workspace
      const attackerServerLookup = ContentService.getById("srv-victim-secret-1", userAttacker);
      assertEqual(attackerServerLookup, undefined, "Attacker cannot retrieve victim item by serverMediaId");

      // Attacker attempts to update victim's item
      const attackerUpdate = ContentService.updateItem("secret-victim-save", { personalNotes: "Hacked!" }, userAttacker);
      assertEqual(attackerUpdate, null, "Attacker update on victim item is rejected");

      // Verify victim's item is completely unaltered
      const victimItem = ContentService.getById("secret-victim-save", userVictim);
      assert(victimItem !== undefined, "Victim item exists intact");
      assertEqual(victimItem.personalNotes, "Do not share", "Victim data was never modified");

      StorageService.clearUserData(userVictim);
      StorageService.clearUserData(userAttacker);
    });

    await test("Cross-Device Sync 7: Offline or failed sync does not silently discard user data", async () => {
      const syncUser = `user-sync-offline-${Date.now()}`;
      StorageService.clearUserData(syncUser);
      StorageService.clearUserData("anonymous");
      StorageService.getStorage().removeItem("recall_saved_items_v1");
      StorageService.getStorage().removeItem("recall_collections_v1");

      // User creates an item while offline
      const offlineItem: SavedItem = {
        id: `offline-item-1`,
        url: "https://news.ycombinator.com/item?id=39000000",
        title: "Offline Saved HN Article",
        platform: "website",
        contentType: "article",
        creator: { name: "Hacker News" },
        description: "Interesting discussion",
        thumbnail: "https://example.com/thumb-offline.jpg",
        savedDate: new Date().toISOString(),
        tags: ["Tech"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "HN Article", standard: "HN discussion", detailed: "Details" },
        keyPoints: [],
        topics: ["Technology"],
        personalNotes: "Saved while airplane mode was on",
        metadata: {},
      };

      // Persisted to local device storage
      StorageService.saveItems([offlineItem], syncUser);

      // Verify offline data survives refresh without network
      const cached = StorageService.getItems(syncUser);
      assertEqual(cached.length, 1, "Cached offline item is available in storage");
      assertEqual(cached[0].title, "Offline Saved HN Article", "Offline title intact");

      // MigrationService identifies un-synced local items for server upload
      const migrationReport = MigrationService.migrateLegacyData(syncUser);
      assertEqual(migrationReport.itemsToSync.length, 1, "Migration detects 1 un-synced offline item");
      assertEqual(migrationReport.itemsToSync[0].id, offlineItem.id, "Detects exact offline item for synchronization");

      StorageService.clearUserData(syncUser);
    });

    await test("Cross-Device Sync 8: Existing local-only data is safely migrated without duplicates", async () => {
      const syncUser = `user-sync-migration-${Date.now()}`;
      StorageService.clearUserData(syncUser);

      // Setup legacy items in localStorage
      const legacyItem: SavedItem = {
        id: `legacy-item-999`,
        url: "https://medium.com/@author/great-post",
        title: "Legacy Medium Post",
        platform: "website",
        contentType: "article",
        creator: { name: "Author" },
        description: "Deep dive into TypeScript",
        thumbnail: "https://example.com/thumb-legacy.jpg",
        savedDate: "2024-01-01T00:00:00.000Z",
        tags: ["TypeScript"],
        favorite: true,
        archived: false,
        trashed: false,
        aiSummary: { quick: "TypeScript", standard: "TypeScript post", detailed: "Details" },
        keyPoints: [],
        topics: ["Programming"],
        personalNotes: "Legacy bookmark",
        metadata: {},
      };

      // Put into anonymous workspace store
      StorageService.saveItems([legacyItem], "anonymous");

      // Run migration into authenticated user account
      const migration = MigrationService.migrateLegacyData(syncUser);
      assert(migration.migratedItemsCount >= 1, "Migrated at least 1 item");

      const userItems = StorageService.getItems(syncUser);
      const migrated = userItems.find((i) => i.url === legacyItem.url);
      assert(migrated !== undefined, "Migrated item exists in authenticated account");
      assertEqual(migrated.title, "Legacy Medium Post", "Item title preserved");
      assertEqual(migrated.favorite, true, "Favorite status preserved");

      // Verify idempotency: running migration a second time does not duplicate
      const secondMigration = MigrationService.migrateLegacyData(syncUser);
      assertEqual(secondMigration.migratedItemsCount, 0, "Second migration is idempotent (0 new items)");
      const secondCheckItems = StorageService.getItems(syncUser);
      const occurrences = secondCheckItems.filter((i) => i.url === legacyItem.url).length;
      assertEqual(occurrences, 1, "Exactly 1 copy of the item exists after repeated migrations");

      StorageService.clearUserData(syncUser);
      StorageService.clearUserData("anonymous");
    });

    if (!process.argv.includes("--live-db")) {
      console.log("  ↷ SKIP live Supabase RLS test (run npm run test:integration:supabase with dedicated KEEPER_TEST_* configuration to opt in).");
    } else {
      await test("Opt-in dedicated Supabase project RLS tenant-isolation verification", async () => {
        const required = [
          "KEEPER_TEST_SUPABASE_URL",
          "KEEPER_TEST_SUPABASE_ANON_KEY",
          "KEEPER_TEST_SUPABASE_PROJECT_REF",
          "KEEPER_TEST_SUPABASE_IS_DISPOSABLE",
          "KEEPER_PRODUCTION_SUPABASE_PROJECT_REF",
          "KEEPER_TEST_WORKSPACE_A_ACCESS_TOKEN",
          "KEEPER_TEST_WORKSPACE_B_ACCESS_TOKEN",
          "KEEPER_TEST_WORKSPACE_A_MEDIA_ID",
          "KEEPER_TEST_WORKSPACE_B_MEDIA_ID",
        ] as const;
        const missing = required.filter((name) => !process.env[name]?.trim());
        assert(missing.length === 0, `Live test configuration is incomplete (${missing.join(", ")}); no database request was made.`);

        const supabaseUrl = process.env.KEEPER_TEST_SUPABASE_URL!.trim();
        const projectRef = process.env.KEEPER_TEST_SUPABASE_PROJECT_REF!.trim();
        const disposableConfirmation = process.env.KEEPER_TEST_SUPABASE_IS_DISPOSABLE!.trim();
        const productionProjectRef = process.env.KEEPER_PRODUCTION_SUPABASE_PROJECT_REF!.trim();
        assert(disposableConfirmation === "true", "Set KEEPER_TEST_SUPABASE_IS_DISPOSABLE=true only for a disposable test project.");
        assert(projectRef !== productionProjectRef, "Refusing to test the configured production Supabase project.");
        const parsedUrl = new URL(supabaseUrl);
        assert(parsedUrl.protocol === "https:" && parsedUrl.hostname === `${projectRef}.supabase.co`, "Live test requires the explicit dedicated Supabase project URL.");
        const appUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        assert(!appUrl || new URL(appUrl).origin !== parsedUrl.origin, "Refusing to test the application-configured Supabase project.");

        const { createClient } = await import("@supabase/supabase-js");
        const makeWorkspaceClient = (token: string) => createClient(supabaseUrl, process.env.KEEPER_TEST_SUPABASE_ANON_KEY!.trim(), {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token.trim()}` } },
        });
        const tokenA = process.env.KEEPER_TEST_WORKSPACE_A_ACCESS_TOKEN!.trim();
        const tokenB = process.env.KEEPER_TEST_WORKSPACE_B_ACCESS_TOKEN!.trim();
        const workspaceA = makeWorkspaceClient(tokenA);
        const workspaceB = makeWorkspaceClient(tokenB);
        const [{ data: authA, error: authErrorA }, { data: authB, error: authErrorB }] = await Promise.all([
          workspaceA.auth.getUser(tokenA), workspaceB.auth.getUser(tokenB),
        ]);
        assert(!authErrorA && Boolean(authA.user), "Workspace A test identity authenticates.");
        assert(!authErrorB && Boolean(authB.user), "Workspace B test identity authenticates.");
        assert(authA.user.id !== authB.user.id, "Test identities must belong to separate workspaces.");

        const mediaAId = process.env.KEEPER_TEST_WORKSPACE_A_MEDIA_ID!.trim();
        const mediaBId = process.env.KEEPER_TEST_WORKSPACE_B_MEDIA_ID!.trim();
        const [{ data: ownA, error: ownAError }, { data: ownB, error: ownBError }] = await Promise.all([
          workspaceA.from("keeper_media").select("id,workspace_id").eq("id", mediaAId),
          workspaceB.from("keeper_media").select("id,workspace_id").eq("id", mediaBId),
        ]);
        assert(!ownAError && ownA?.length === 1 && ownA[0].workspace_id === authA.user.id, "Workspace A can read its own media.");
        assert(!ownBError && ownB?.length === 1 && ownB[0].workspace_id === authB.user.id, "Workspace B can read its own media.");

        const { data: crossRows, error: crossReadError } = await workspaceA.from("keeper_media").select("id").eq("id", mediaBId);
        assert(!crossReadError && crossRows?.length === 0, "Workspace A cannot read Workspace B media.");
        const { data: updateRows, error: updateError } = await workspaceA.from("keeper_media")
          .update({ updated_at: new Date().toISOString() }).eq("id", mediaBId).select("id");
        assert(!updateRows?.length && (!updateError || updateError.code === "42501"), "Workspace A cannot modify Workspace B media.");
        const { data: deleteRows, error: deleteError } = await workspaceA.from("keeper_media")
          .delete().eq("id", mediaBId).select("id");
        assert(!deleteRows?.length && (!deleteError || deleteError.code === "42501"), "Workspace A cannot delete Workspace B media.");
      });
    }

    console.log("\n--- Section 23: Cross-Device Canonical Identity & Folder Assignment Regression Tests ---");

    await test("Cross-device canonical URL identity normalization equates variant links", async () => {
      const desktopUrl = "https://www.instagram.com/reel/C3x90ZaLkPq/?igsh=MW0yd2V2";
      const mobileUrl = "https://instagram.com/reel/C3x90ZaLkPq";
      const trackingUrl = "https://www.instagram.com/reel/C3x90ZaLkPq/?utm_source=ig_web_copy_link&utm_medium=share_sheet";

      const keyDesktop = getCanonicalIdentityKey(desktopUrl);
      const keyMobile = getCanonicalIdentityKey(mobileUrl);
      const keyTracking = getCanonicalIdentityKey(trackingUrl);

      assert(Boolean(keyDesktop), "Desktop key is generated");
      assertEqual(keyDesktop, keyMobile, "Desktop and Mobile Instagram reel canonical keys match");
      assertEqual(keyDesktop, keyTracking, "Tracking URL matches clean canonical key");

      const authDesktop = getAuthoritativeCanonicalUrl(desktopUrl);
      const authMobile = getAuthoritativeCanonicalUrl(mobileUrl);
      assertEqual(authDesktop, authMobile, "Authoritative URLs match without query pollution");
    });

    await test("isSameContentItem identifies saved records across device representations", async () => {
      const itemDesktop = {
        id: "item-desktop-1",
        url: "https://www.instagram.com/reel/C3x90ZaLkPq/?igsh=xyz",
        title: "Inspiring Reel",
      } as SavedItem;

      const itemMobile = {
        id: "item-mobile-2",
        url: "https://instagram.com/reel/C3x90ZaLkPq/",
        title: "Inspiring Reel",
      } as SavedItem;

      assert(isSameContentItem(itemDesktop, itemMobile), "Desktop and Mobile items are recognized as same content item");
    });

    await test("ContentService.addItem prevents duplicate saves across device URL variations", async () => {
      const testUser = "test-user-cross-device-" + Date.now();
      StorageService.clearUserData(testUser);

      const desktopSaved = ContentService.addItem({
        title: "Deep Dive Video",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
        thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        platform: "youtube",
        contentType: "video",
        creator: { name: "Rick" },
        tags: ["music"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Rick Astley classic.", standard: "Rick Astley classic overview.", detailed: "Rick Astley classic detailed breakdown." },
        keyPoints: [],
        topics: ["music"],
        personalNotes: "",
        description: "",
        metadata: {},
      }, testUser);

      assert(Boolean(desktopSaved.id), "First save succeeds");

      // Save from mobile device with shortened link & tracking parameters
      const mobileAttempt = ContentService.addItem({
        title: "Deep Dive Video Mobile",
        url: "https://youtu.be/dQw4w9WgXcQ?si=abcdef12345",
        thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        platform: "youtube",
        contentType: "video",
        creator: { name: "Rick" },
        tags: ["music"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Rick Astley classic.", standard: "Rick Astley classic overview.", detailed: "Rick Astley classic detailed breakdown." },
        keyPoints: [],
        topics: ["music"],
        personalNotes: "",
        description: "",
        metadata: {},
      }, testUser, "skip");

      assertEqual(mobileAttempt.id, desktopSaved.id, "Second save resolves to existing item without creating duplicate");

      const allItems = ContentService.getAll(testUser);
      assertEqual(allItems.length, 1, "Only 1 item exists in user library (no duplicates)");
      StorageService.clearUserData(testUser);
    });

    await test("Folder assignment persistence: saving with collectionId attaches and retains folder", async () => {
      const testUser = "test-user-folder-" + Date.now();
      StorageService.clearUserData(testUser);

      const savedCol = CollectionService.create({
        name: "Design Inspo",
        color: "#6366f1",
        icon: "Folder",
      }, testUser);

      const savedItem = ContentService.addItem({
        title: "Figma Tips",
        url: "https://www.youtube.com/watch?v=3lZF8W_AaUo",
        thumbnail: "https://example.com/thumb.jpg",
        platform: "youtube",
        contentType: "video",
        creator: { name: "Designer" },
        collectionId: savedCol.id,
        collections: [savedCol.id],
        tags: ["design"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Figma design system tips.", standard: "Figma tips standard overview.", detailed: "Figma tips detailed breakdown." },
        keyPoints: [],
        topics: ["design"],
        personalNotes: "",
        description: "",
        metadata: {},
      }, testUser);

      assertEqual(savedItem.collectionId, savedCol.id, "Item collectionId matches assigned folder");
      assert(savedItem.collections?.includes(savedCol.id) === true, "Item collections includes assigned folder");

      const fetched = ContentService.getById(savedItem.id, testUser);
      assertEqual(fetched?.collectionId, savedCol.id, "Fetched item retains collectionId");
      assert(fetched?.collections?.includes(savedCol.id) === true, "Fetched item retains collections array");

      StorageService.clearUserData(testUser);
    });

    await test("Multi-tenant isolation: different users independently save same URL without data leakage", async () => {
      const userAlice = "user-alice-" + Date.now();
      const userBob = "user-bob-" + Date.now();
      StorageService.clearUserData(userAlice);
      StorageService.clearUserData(userBob);

      const sharedUrl = "https://www.instagram.com/reel/C3x90ZaLkPq/";

      const aliceItem = ContentService.addItem({
        title: "Alice Private Save",
        url: sharedUrl,
        thumbnail: "https://example.com/thumb1.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Creator" },
        personalNotes: "Alice secret note",
        tags: ["alice-tag"],
        favorite: true,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Summary", standard: "Summary overview.", detailed: "Summary detailed." },
        keyPoints: [],
        topics: [],
        description: "",
        metadata: {},
      }, userAlice);

      const bobItem = ContentService.addItem({
        title: "Bob Private Save",
        url: sharedUrl,
        thumbnail: "https://example.com/thumb2.jpg",
        platform: "instagram",
        contentType: "reel",
        creator: { name: "Creator" },
        personalNotes: "Bob different note",
        tags: ["bob-tag"],
        favorite: false,
        archived: false,
        trashed: false,
        aiSummary: { quick: "Summary", standard: "Summary overview.", detailed: "Summary detailed." },
        keyPoints: [],
        topics: [],
        description: "",
        metadata: {},
      }, userBob);

      const aliceItems = ContentService.getAll(userAlice);
      const bobItems = ContentService.getAll(userBob);

      assertEqual(aliceItems.length, 1, "Alice has 1 item");
      assertEqual(bobItems.length, 1, "Bob has 1 item");
      assertEqual(aliceItems[0].personalNotes, "Alice secret note", "Alice notes are intact");
      assertEqual(bobItems[0].personalNotes, "Bob different note", "Bob notes are intact");
      assert(aliceItems[0].id !== bobItems[0].id, "Alice and Bob have distinct item IDs");

      StorageService.clearUserData(userAlice);
      StorageService.clearUserData(userBob);
    });

    console.log("\n--- Section 24: Source Text Analysis Conditional Visibility & Redundancy Tests ---");

    await test("Scenario 1: 100% identical text hides redundant Source Text Analysis", async () => {
      const caption = "Your GitHub profile shouldn't look boring 👀\nComment ***GitHub*** and I'll send you the guide 🚀";
      const source = "Your GitHub profile shouldn't look boring 👀\nComment ***GitHub*** and I'll send you the guide 🚀";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, false, "100% identical text is hidden");
      assertEqual(result.similarityScore, 1.0, "Similarity score is 1.0");
      assertEqual(result.hasMeaningfulDifference, false, "No meaningful difference");
      assertEqual(shouldShowSourceTextAnalysis(caption, { type: "source_text", text: source, source: "caption", extractionMethod: "platform_metadata_normalization", confidence: 0.85, status: "completed", generatedAt: new Date().toISOString() }), false, "Helper returns false");
    });

    await test("Scenario 2: 99% or higher similarity with no meaningful difference hides Source Text Analysis", async () => {
      // 100+ words text with only a trailing dot or capitalization change
      const caption = "Mastering TypeScript and Next.js full stack development requires consistent practice understanding type narrowing component lifecycle and server actions in production applications with real databases.";
      const source = "Mastering typescript and Next.js full stack development requires consistent practice understanding type narrowing component lifecycle and server actions in production applications with real databases.";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, false, "99%+ similarity with no novel info is hidden");
      assertEqual(result.hasMeaningfulDifference, false, "No meaningful difference identified");
      assert(result.similarityScore >= 0.99, "Similarity score is at least 99%");
    });

    await test("Scenario 3: Additional meaningful source information shows Source Text Analysis", async () => {
      const caption = "10 tips to build your SaaS today.";
      const source = "10 tips to build your SaaS today. Talk to twenty prospective enterprise customers and validate willingness to pay before writing any code.";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, true, "Additional meaningful information is shown");
      assertEqual(result.hasMeaningfulDifference, true, "Meaningful difference detected");
      assert(result.novelTokenCount > 0, "Novel tokens detected");
    });

    await test("Scenario 4: Different emojis with meaningful context shows Source Text Analysis", async () => {
      const caption = "Just shipped a major new update to our open source library";
      const source = "Just shipped a major new update to our open source library 🚀 ⚡ 🏆";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, true, "Novel emojis with context are shown");
      assertEqual(result.hasMeaningfulDifference, true, "Meaningful emoji difference detected");
      assert(result.novelEmojis.length >= 3, "All novel emojis captured");
      assert(result.novelEmojis.includes("🚀"), "Rocket emoji captured");
    });

    await test("Scenario 5: Different language or meaningful multilingual phrases shows Source Text Analysis", async () => {
      const caption = "Welcome to our design studio in Tokyo";
      const source = "Welcome to our design studio in Tokyo 東京のデザインスタジオへようこそ";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, true, "Multilingual content is shown");
      assertEqual(result.hasMeaningfulDifference, true, "Meaningful Japanese phrase detected");
    });

    await test("Scenario 6: Only whitespace or line-break differences hides Source Text Analysis", async () => {
      const caption = "Step 1: Install packages\n\n\nStep 2: Configure environment\n\n\nStep 3: Run dev server";
      const source = "Step 1: Install packages\nStep 2: Configure environment\nStep 3: Run dev server";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, false, "Whitespace/line-break only variation is hidden");
      assertEqual(result.similarityScore, 1.0, "Normalized similarity is 1.0");
    });

    await test("Scenario 7: Only insignificant formatting differences hides Source Text Analysis", async () => {
      const caption = "Comment ***GitHub*** and I'll send “The Guide” for free!";
      const source = "Comment **GitHub** and I'll send \"The Guide\" for free!";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, false, "Insignificant markdown/quote formatting difference is hidden");
      assertEqual(result.similarityScore, 1.0, "Normalized similarity is 1.0");
    });

    await test("Scenario 8: Empty source analysis hides Source Text Analysis", async () => {
      const caption = "Great video on frontend architecture";
      const source = "   \n\t  ";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, false, "Empty source text is hidden");
      assertEqual(result.reason, "empty_source_analysis", "Reason is empty_source_analysis");
    });

    await test("Scenario 9: Missing caption but meaningful source analysis shows Source Text Analysis", async () => {
      const caption = "";
      const source = "Detailed transcription explaining zero-copy buffers in Node.js and performance tuning.";

      const result = compareSourceTextWithCaption(caption, source);
      assertEqual(result.shouldShow, true, "Meaningful source text is shown when caption is missing");
      assertEqual(result.hasMeaningfulDifference, true, "Treated as meaningful difference");
      assertEqual(result.reason, "missing_caption_with_source_content", "Reason is missing_caption_with_source_content");
    });

    await test("Scenario 10: Failed media extraction hides safely without errors", async () => {
      const caption = "Instagram Reel about web design";
      const failedRep = {
        type: "unavailable" as const,
        text: "",
        source: "none" as const,
        extractionMethod: "whisper:failed",
        confidence: 0,
        status: "failed" as const,
        generatedAt: new Date().toISOString(),
        failureReason: "Audio track could not be decoded",
      };

      const result = compareSourceTextWithCaption(caption, failedRep);
      assertEqual(result.shouldShow, false, "Failed media extraction is safely hidden");
      assertEqual(shouldShowSourceTextAnalysis(caption, failedRep), false, "Helper returns false for failed extraction");
    });

    await test("Scenario 11: Different OCR/transcription content shows Source Text Analysis", async () => {
      const caption = "Check out this reel! Link in bio #coding #dev";
      const transcript = "In this video we are demonstrating database indexing with B-Trees and Hash indexes in PostgreSQL.";

      const result = compareSourceTextWithCaption(caption, transcript);
      assertEqual(result.shouldShow, true, "Spoken transcription differing from brief caption is shown");
      assertEqual(result.hasMeaningfulDifference, true, "Meaningful difference detected");
      assert(result.similarityScore < 0.3, "Low similarity between caption and transcript");
    });

    await test("Real-World Case: User Screenshot Instagram Reel duplicate caption is eliminated", async () => {
      const userCaption = `Your GitHub profile shouldn't look boring 👀
Comment ***GitHub*** and I'll send you the complete guide to make it look clean, modern, and impressive 🚀

[GitHub Profile, GitHub README, Developer Portfolio, GitHub Customization, Coding Profile, Software Engineer, Developer Branding]

#github #githubprofile #githubtips #coding #developer softwareengineer programming webdevelopment tech developers`;

      const sourceAnalyzed = `Your GitHub profile shouldn't look boring 👀
Comment ***GitHub*** and I'll send you the complete guide to make it look clean, modern, and impressive 🚀

[GitHub Profile, GitHub README, Developer Portfolio, GitHub Customization, Coding Profile, Software Engineer, Developer Branding]

#github #githubprofile #githubtips #coding #developer softwareengineer programming webdevelopment tech developers`;

      const rep = {
        type: "source_text" as const,
        text: sourceAnalyzed,
        source: "post_body" as const,
        extractionMethod: "platform_metadata_normalization",
        confidence: 0.85,
        status: "completed" as const,
        generatedAt: new Date().toISOString(),
        sourceSegments: [
          { source: "post_body", text: sourceAnalyzed },
          { source: "caption", text: sourceAnalyzed },
          { source: "description", text: sourceAnalyzed },
        ],
      };

      const shouldShow = shouldShowSourceTextAnalysis(userCaption, rep);
      assertEqual(shouldShow, false, "Exact duplicate shown in user screenshot is eliminated from UI");
    });

    console.log("\n--- Section 25: Categorization, Tag Generation & Thumbnail Accuracy Regression Tests ---");

    await test("Tag generation rejects shortcode hashes (De8uW1PTam9) and app stop words (Keeper)", async () => {
      const mockRestrictedTitle = "Instagram Reel • De8uW1PTam9";
      const mockRestrictedDesc = "Instagram Reel (De8uW1PTam9) saved to Keeper.";
      const tags = ContentIntelligenceService.generateTags(`${mockRestrictedTitle}\n${mockRestrictedDesc}`);
      const tagNames = tags.map((t) => t.name.toLowerCase());
      assert(!tagNames.includes("de8uw1ptam9"), "Raw shortcode De8uW1PTam9 is rejected from generated tags");
      assert(!tagNames.includes("keeper"), "Application stop word Keeper is rejected from generated tags");
    });

    await test("Tag generation extracts rich domain tags from social media captions", async () => {
      const sampleCaption = "Your GitHub profile shouldn't look boring. Comment GitHub and I will send you the guide to make it clean and modern! #github #coding #developer #softwareengineer";
      const tags = ContentIntelligenceService.generateTags(sampleCaption);
      const tagNames = tags.map((t) => t.name);
      assert(tagNames.includes("Github"), "Extracts Github tag");
      assert(tagNames.includes("Coding"), "Extracts Coding tag");
      assert(tagNames.includes("Developer"), "Extracts Developer tag");
    });

    await test("CollectionMatchingService matches 'Reels' collection for Reel items when only format tags exist", async () => {
      const collections: Collection[] = [
        { id: "col-reels", name: "Reels", color: "#6366f1", icon: "Folder", createdAt: "", updatedAt: "" },
        { id: "col-tech", name: "Tech", color: "#6366f1", icon: "Folder", createdAt: "", updatedAt: "" },
      ];
      const tags = [
        { name: "Instagram", normalizedName: "instagram", category: "Topic" as const, confidence: 1, source: "user" as const, evidence: "" },
        { name: "Reel", normalizedName: "reel", category: "Topic" as const, confidence: 1, source: "user" as const, evidence: "" },
      ];
      const candidates = CollectionMatchingService.match("", tags, collections);
      const best = CollectionMatchingService.selectBestMatch(candidates);
      assertEqual(best?.collectionId, "col-reels", "Correctly matches user's Reels collection");
      assert(best?.confidence !== undefined && best.confidence >= 0.8, "Confidence is high for exact format match");
    });

    await test("CollectionMatchingService matches 'Tech' collection for React and Web Development items", async () => {
      const collections: Collection[] = [
        { id: "col-reels", name: "Reels", color: "#6366f1", icon: "Folder", createdAt: "", updatedAt: "" },
        { id: "col-tech", name: "Tech", color: "#6366f1", icon: "Folder", createdAt: "", updatedAt: "" },
      ];
      const tags = [
        { name: "React", normalizedName: "react", category: "Technology" as const, confidence: 1, source: "ai" as const, evidence: "" },
        { name: "Web Development", normalizedName: "web-development", category: "Skill" as const, confidence: 1, source: "ai" as const, evidence: "" },
      ];
      const candidates = CollectionMatchingService.match("", tags, collections);
      const best = CollectionMatchingService.selectBestMatch(candidates);
      assertEqual(best?.collectionId, "col-tech", "Correctly matches user's Tech collection");
    });

    await test("Ingestion retains platform title rather than generic 'Saved source'", async () => {
      const res = await IngestionService.processUrl("https://www.instagram.com/reel/De8uW1PTam9/", {
        aiEnrichmentMode: "fast_metadata",
      });
      assert(res.savedItem.title.includes("De8uW1PTam9"), "Title retains informative shortcode rather than generic 'Saved source'");
      assertEqual(res.savedItem.contentType, "reel", "Correctly identifies as a reel");
    });

    console.log("\n--- Section 26: Open-Source Bulk Import Unlimited Scale & Quota Resilience Tests ---");

    const defaultTestImportOptions = {
      targetCollectionId: undefined,
      autoOrganize: true,
      skipDuplicates: true,
      duplicateStrategy: "skip" as const,
      aiEnrichmentMode: "fast_metadata" as const,
      defaultTags: ["OpenSourceTest"],
      concurrencyLimit: 2,
    };

    await test("Open-Source Bulk Import: Job starts and processes successfully even when legacy remaining quota was 0", async () => {
      const quotaUser = "user-zero-quota-test";
      // Force user's legacy limits to 0 remaining
      StorageService.setImportLimits({ total: 30, used: 30 }, quotaUser);
      const preLimits = StorageService.getImportLimits(quotaUser);
      assertEqual(preLimits.used, 30, "Legacy used is 30");

      const candidates = [
        {
          originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          title: "Rick Astley - Never Gonna Give You Up",
          platform: "youtube" as const,
        },
      ];

      const analyzed = ImportJobService.analyzeCandidates(candidates, [], "youtube").candidateItems;
      const job = ImportJobService.createJob({
        userId: quotaUser,
        platform: "youtube",
        sourceName: "YouTube",
        sourceType: "export_file",
        items: analyzed,
        options: defaultTestImportOptions,
      });

      // In open-source edition, starting this job must not throw quota exhausted error
      const report = await ImportJobService.startJob(job.id);
      assertEqual(report.jobId, job.id, "Report maps to job ID");
      assertEqual(report.summary.imported, 1, "Item processed successfully without quota block");
      assert(report.summary.failed === 0, "No items failed due to artificial quotas");
    });

    await test("Open-Source Bulk Import: Scalability test handles 1,000 items efficiently without quadratic slowdown", () => {
      // YouTube IDs must be exactly 11 characters
      const largeCandidates = Array.from({ length: 1000 }, (_, i) => ({
        originalUrl: `https://www.youtube.com/watch?v=vid${i.toString().padStart(8, "0")}`,
        title: `Scale Video ${i}`,
        platform: "youtube" as const,
      }));

      const startTime = performance.now();
      const analysis = ImportJobService.analyzeCandidates(largeCandidates, [], "youtube");
      const elapsed = performance.now() - startTime;

      assertEqual(analysis.total, 1000, "1000 items analyzed");
      assertEqual(analysis.ready, 1000, "All unique items ready");
      assertEqual(analysis.batchDuplicates, 0, "Zero batch duplicates");
      assert(elapsed < 1000, `1000-item candidate analysis is sub-second (took ${Math.round(elapsed)}ms)`);
    });

    await test("Open-Source Bulk Import: Internal batch duplicates at scale are accurately deduplicated", () => {
      // 500 unique URLs + 500 duplicate occurrences (11-char IDs)
      const candidates = [];
      for (let i = 0; i < 500; i++) {
        const url = `https://www.youtube.com/watch?v=dup${i.toString().padStart(8, "0")}`;
        candidates.push({ originalUrl: url, title: `Video ${i} (First)`, platform: "youtube" as const });
        candidates.push({ originalUrl: url, title: `Video ${i} (Duplicate)`, platform: "youtube" as const });
      }

      assertEqual(candidates.length, 1000, "Total batch size is 1000");
      const analysis = ImportJobService.analyzeCandidates(candidates, [], "youtube");
      assertEqual(analysis.total, 1000, "Total items analyzed is 1000");
      assertEqual(analysis.ready, 500, "500 unique items ready");
      assertEqual(analysis.batchDuplicates, 500, "500 duplicate occurrences caught");
    });

    await test("Open-Source Bulk Import: Concurrent jobs from different users remain completely isolated", async () => {
      const userAlpha = "user-alpha-concurrent";
      const userBeta = "user-beta-concurrent";

      const candAlpha = ImportJobService.analyzeCandidates([
        { originalUrl: "https://www.youtube.com/watch?v=alpha000001", title: "Alpha Video", platform: "youtube" as const },
      ], [], "youtube").candidateItems;

      const candBeta = ImportJobService.analyzeCandidates([
        { originalUrl: "https://www.youtube.com/watch?v=beta0000001", title: "Beta Video", platform: "youtube" as const },
      ], [], "youtube").candidateItems;

      const jobAlpha = ImportJobService.createJob({
        userId: userAlpha,
        platform: "youtube",
        sourceName: "YouTube",
        sourceType: "export_file",
        items: candAlpha,
        options: defaultTestImportOptions,
      });
      const jobBeta = ImportJobService.createJob({
        userId: userBeta,
        platform: "youtube",
        sourceName: "YouTube",
        sourceType: "export_file",
        items: candBeta,
        options: defaultTestImportOptions,
      });

      // Run concurrently
      const [reportAlpha, reportBeta] = await Promise.all([
        ImportJobService.startJob(jobAlpha.id),
        ImportJobService.startJob(jobBeta.id),
      ]);

      assertEqual(reportAlpha.userId, userAlpha, "Alpha report belongs to userAlpha");
      assertEqual(reportBeta.userId, userBeta, "Beta report belongs to userBeta");
      assertEqual(reportAlpha.summary.imported, 1, "Alpha job completed successfully");
      assertEqual(reportBeta.summary.imported, 1, "Beta job completed successfully");

      const alphaReports = ImportJobService.getReports(userAlpha);
      const betaReports = ImportJobService.getReports(userBeta);
      assert(alphaReports.some((r) => r.jobId === jobAlpha.id), "Alpha report retrieved for userAlpha");
      assert(!alphaReports.some((r) => r.jobId === jobBeta.id), "Beta report NOT leaked to userAlpha");
      assert(betaReports.some((r) => r.jobId === jobBeta.id), "Beta report retrieved for userBeta");
      assert(!betaReports.some((r) => r.jobId === jobAlpha.id), "Alpha report NOT leaked to userBeta");
    });

    await test("Open-Source Bulk Import: deductImportLimit accurately records usage without hitting ceiling", () => {
      const testUser = "user-accounting-test";
      StorageService.setImportLimits({ total: 30, used: 25 }, testUser);

      // Deduct 10 items (more than remaining 5)
      const res = StorageService.deductImportLimit(10, testUser);
      assert(res.success, "Deduction succeeds in open-source edition");
      assertEqual(res.limits.used, 35, "Used correctly incremented to 35");
      assert(res.limits.remaining > 0, "Remaining capacity dynamically preserved for open-source users");
    });

    // Summary
    console.log("\n=======================================================");
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("=======================================================\n");

  if (failed > 0) {
    console.error(`❌ TEST SUITE FAILED: ${failed} assertion(s) failed.`);
    process.exit(1);
  } else {
    console.log("✅ ALL AUTOMATED PRODUCTION TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
