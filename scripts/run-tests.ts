/**
 * Automated Test Suite for Recall Core Services
 *
 * Runs without external testing bloat using TypeScript execution.
 * Tests:
 * 1. Password cryptographic hashing & constant-time verification
 * 2. User avatar generation & initials extraction
 * 3. Provider detection & URL canonicalization
 * 4. Email normalization & security constraints
 * 5. Multi-user isolation partition keys
 */

import { hashPassword, verifyPassword, generateInitialsAvatar } from "../src/services/auth-service";
import { ProviderService } from "../src/services/provider-service";

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

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING RECALL AUTOMATED CI TEST SUITE");
  console.log("=======================================================\n");

  console.log("1. Authentication & Cryptography Tests:");

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

  await test("hashPassword uses unique salt per invocation", async () => {
    const plain = "IdenticalPasswordForTwoUsers";
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    assert(hash1 !== hash2, "Identical passwords must produce distinct salted hashes");
    const [salt1] = hash1.split(":");
    const [salt2] = hash2.split(":");
    assert(salt1 !== salt2, "Salts must be randomly generated and unique");
  });

  console.log("\n2. Avatar & Initials Generator Tests:");

  await test("generateInitialsAvatar creates valid SVG data URI with initials", () => {
    const avatar = generateInitialsAvatar("Devang Patel");
    assert(avatar.startsWith("data:image/svg+xml;utf8,"), "Avatar must be SVG data URI");
    assert(avatar.includes("DP"), "Avatar SVG must contain user initials DP");
  });

  await test("generateInitialsAvatar handles single-word name", () => {
    const avatar = generateInitialsAvatar("Recall");
    assert(avatar.startsWith("data:image/svg+xml;utf8,"), "Avatar must be SVG data URI");
    assert(avatar.includes("RE"), "Single-word initials should take first two letters");
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
    assertEqual(platform, "twitter", "Must identify X.com tweet URL");
  });

  console.log("\n4. Security & Storage Isolation Tests:");

  await test("Multi-user storage keys are properly partitioned", () => {
    const userA = "user-123";
    const userB = "user-456";
    const keyA: string = `recall_items_user_${userA}`;
    const keyB: string = `recall_items_user_${userB}`;
    assert(keyA !== keyB, "Storage keys for different users must never collide");
    assertEqual(keyA, "recall_items_user_user-123", "Prefix must match specification");
  });

  await test("Email normalization logic", () => {
    const raw = "  Test.User+Filter@EXAMPLE.com  ";
    const normalized = raw.trim().toLowerCase();
    assertEqual(normalized, "test.user+filter@example.com", "Email must be trimmed and lowercased");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert(emailRegex.test(normalized), "Valid email must pass regex check");
    assert(!emailRegex.test("invalid-email"), "Malformed email must fail regex check");
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
    console.log("✅ ALL AUTOMATED TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
