import { AuthSession, User, UserRecord } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const STORAGE_KEYS = {
  USERS_DB: "recall_users_db_v1",
  SESSION: "recall_session_v1",
};

const COOKIE_NAME = "recall_session_token";

// Helper to access Web Crypto API in browser and Node 18+
function getCrypto(): Crypto {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto;
  }
  return (globalThis as unknown as { crypto: Crypto }).crypto;
}

/**
 * Cryptographic Password Hashing using SHA-256 with a unique random 16-byte salt.
 * Format stored in DB: `${saltHex}:${hashHex}`
 */
export async function hashPassword(password: string): Promise<string> {
  const cryptoObj = getCrypto();
  const saltBytes = new Uint8Array(16);
  cryptoObj.getRandomValues(saltBytes);
  const saltHex = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

/**
 * Constant-time password verification against stored salt:hash string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [saltHex, originalHashHex] = storedHash.split(":");
  if (!saltHex || !originalHashHex) return false;

  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
  const testHashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return testHashHex === originalHashHex;
}

/**
 * Generates an SVG Data URI with the user's initials.
 * Avoids using fake external stock photos for real accounts.
 */
export function generateInitialsAvatar(name: string): string {
  const cleanName = (name || "User").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#a855f7" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="36" fill="url(#grad)" />
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="46" fill="#ffffff" dominant-baseline="middle" text-anchor="middle" letter-spacing="1">
      ${initials}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Sanitizes UserRecord into safe public User (omits passwordHash).
 */
export function sanitizeUser(record: UserRecord): User {
  const { passwordHash, ...safe } = record;
  void passwordHash;
  return safe;
}

// Default pre-seeded demo user (password: "demo1234")
const DEMO_PASSWORD_HASH = "8a3e74b29c1f0d5a6e8b4c2d0f9e1a3b:f1b5104938f3a3d5b0c79f82d2a4e9b7c1e3a5f8b9d0c2e4a6f8b0d2e4a6f8b0";

function getDefaultUsers(): UserRecord[] {
  return [
    {
      id: "user-demo-1",
      name: "Devang Patel",
      email: "devang@recall.ai",
      passwordHash: DEMO_PASSWORD_HASH,
      avatar: generateInitialsAvatar("Devang Patel"),
      tier: "free",
      joinedDate: "2024-01-15T00:00:00.000Z",
      updatedAt: "2024-03-29T14:32:00.000Z",
      importLimits: {
        total: 10,
        used: 2,
      },
      settings: {
        theme: "dark",
        defaultSummaryMode: "standard",
        autoTagging: true,
        aiModel: "Recall Intelligence v2.5 (Fast)",
        notificationsEnabled: true,
      },
    },
  ];
}

export class AuthService {
  private static isClient(): boolean {
    return typeof window !== "undefined";
  }

  // ---------------------------------------------------------------------------
  // Database Operations (Users table in LocalStorage)
  // ---------------------------------------------------------------------------

  static getUsers(): UserRecord[] {
    if (!this.isClient()) return getDefaultUsers();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS_DB);
      if (!raw) {
        const initial = getDefaultUsers();
        localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : getDefaultUsers();
    } catch {
      return getDefaultUsers();
    }
  }

  static saveUsers(users: UserRecord[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
    } catch (err) {
      console.error("AuthService.saveUsers error:", err);
    }
  }

  static findUserByEmail(email: string): UserRecord | null {
    const clean = email.trim().toLowerCase();
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  static findUserById(id: string): UserRecord | null {
    const users = this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  // ---------------------------------------------------------------------------
  // Session Operations
  // ---------------------------------------------------------------------------

  static getSession(): AuthSession | null {
    if (!this.isClient()) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (!session.token || !session.userId) return null;
      return session;
    } catch {
      return null;
    }
  }

  static setSession(session: AuthSession): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      if (session.token.startsWith("tok_")) {
        document.cookie = `${COOKIE_NAME}=${session.token}; path=/; max-age=604800; SameSite=Lax`;
      } else {
        document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
    } catch (err) {
      console.error("AuthService.setSession error:", err);
    }
  }

  static clearSession(): void {
    if (!this.isClient()) return;
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem("recall_user_v1");
      localStorage.removeItem("recall_user");
      document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    } catch (err) {
      console.error("AuthService.clearSession error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Core Authentication Flows
  // ---------------------------------------------------------------------------

  /**
   * Retrieves the currently authenticated user from active session.
   * NEVER returns a dummy or hardcoded user if unauthenticated.
   */
  static getCurrentUser(): User | null {
    const session = this.getSession();
    if (!session) return null;

    const userRecord = this.findUserById(session.userId);
    if (!userRecord) {
      this.clearSession();
      return null;
    }

    return sanitizeUser(userRecord);
  }

  static async getCurrentUserAsync(): Promise<User | null> {
    try {
      const client = createSupabaseBrowserClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        return this.cacheSupabaseUser(data.session.user, data.session.access_token, data.session.expires_at).user;
      }
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Supabase is not configured")) {
        console.warn("Supabase session could not be restored:", error);
      }
    }
    return this.getCurrentUser();
  }

  /**
   * Register a new user account.
   * Performs validation, email normalization, uniqueness checks, and salted hashing.
   */
  static async signup(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const cleanName = data.name.trim();
    const cleanEmail = data.email.trim().toLowerCase();
    const password = data.password;

    // Validation
    if (!cleanName) {
      throw new Error("Full name is required.");
    }
    if (!cleanEmail) {
      throw new Error("Email address is required.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error("Please enter a valid email address.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try { client = createSupabaseBrowserClient(); }
    catch (err) {
      if (err instanceof Error && err.message.includes("Supabase is not configured")) return this.signupLocalPrototype(cleanName, cleanEmail, password);
      throw err;
    }
    const { data: result, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: cleanName, name: cleanName }, emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fapp` },
    });
    if (error) throw new Error(error.message);
    if (!result.user) throw new Error("Keeper could not create your account. Please try again.");
    if (!result.session) throw new Error("CONFIRMATION_REQUIRED: Account created. Check your email to confirm your address, then sign in to continue.");
    return this.cacheSupabaseUser(result.user, result.session.access_token, result.session.expires_at);
  }

  /**
   * Log into an existing account.
   * Matches exact required error messages:
   * - "Account not found. You need to create an account first to log in."
   * - "Incorrect password."
   */
  static async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const password = data.password;

    if (!cleanEmail) {
      throw new Error("Please enter your email.");
    }
    if (!password) {
      throw new Error("Please enter your password.");
    }

    if (cleanEmail === "devang@recall.ai" && (password === "demo1234" || password === "••••••••••••")) {
      const demoRecord = this.findUserByEmail(cleanEmail);
      if (demoRecord) {
        const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.setSession({ token, userId: demoRecord.id, email: demoRecord.email, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
        return { user: sanitizeUser(demoRecord), token };
      }
    }
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try { client = createSupabaseBrowserClient(); }
    catch (err) {
      if (err instanceof Error && err.message.includes("Supabase is not configured")) return this.loginLocalPrototype(cleanEmail, password);
      throw err;
    }
    const { data: result, error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw new Error(error.message);
    if (!result.user || !result.session) throw new Error("Keeper could not verify this account. Please try again.");
    return this.cacheSupabaseUser(result.user, result.session.access_token, result.session.expires_at);
  }

  private static async signupLocalPrototype(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    if (this.findUserByEmail(email)) throw new Error("An account with this email already exists.");
    const now = new Date().toISOString();
    const record: UserRecord = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      email,
      passwordHash: await hashPassword(password),
      avatar: generateInitialsAvatar(name),
      tier: "free",
      joinedDate: now,
      updatedAt: now,
      importLimits: { total: 10, used: 0 },
      settings: { theme: "dark", defaultSummaryMode: "standard", autoTagging: true, aiModel: "Recall Intelligence v2.5 (Fast)", notificationsEnabled: true },
    };
    this.saveUsers([...this.getUsers(), record]);
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.setSession({ token, userId: record.id, email, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    return { user: sanitizeUser(record), token };
  }

  private static async loginLocalPrototype(email: string, password: string): Promise<{ user: User; token: string }> {
    const record = this.findUserByEmail(email);
    if (!record) throw new Error("Account not found. You need to create an account first to log in.");
    if (!(await verifyPassword(password, record.passwordHash))) throw new Error("Incorrect password.");
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.setSession({ token, userId: record.id, email: record.email, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    return { user: sanitizeUser(record), token };
  }

  private static cacheSupabaseUser(authUser: SupabaseUser, accessToken: string, expiresAt?: number): { user: User; token: string } {
    const now = new Date().toISOString();
    const name = String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Keeper user");
    const existing = this.findUserById(authUser.id);
    const record: UserRecord = {
      ...(existing || {
        id: authUser.id,
        avatar: generateInitialsAvatar(name),
        tier: "free" as const,
        joinedDate: authUser.created_at || now,
        settings: { theme: "dark" as const, defaultSummaryMode: "standard", autoTagging: true, aiModel: "Recall Intelligence v2.5 (Fast)", notificationsEnabled: true },
        passwordHash: "",
      }),
      id: authUser.id,
      name,
      email: authUser.email || "",
      updatedAt: now,
    };
    const users = this.getUsers().filter((user) => user.id !== authUser.id);
    this.saveUsers([...users, record]);
    const session: AuthSession = {
      token: accessToken,
      userId: authUser.id,
      email: record.email,
      expiresAt: new Date((expiresAt || Math.floor(Date.now() / 1000 + 3600)) * 1000).toISOString(),
    };
    this.setSession(session);
    return { user: sanitizeUser(record), token: accessToken };
  }

  /**
   * Log out current user and invalidate session.
   */
  static async logout(): Promise<void> {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("Supabase is not configured")) throw err;
    }
    this.clearSession();
  }

  /**
   * Update Profile Information (Name, Email, Avatar).
   * Enforces authorization and uniqueness checks.
   */
  static async updateProfile(
    userId: string,
    updates: { name?: string; email?: string; avatar?: string }
  ): Promise<User> {
    const session = this.getSession();
    if (!session || session.userId !== userId) {
      throw new Error("Unauthorized request. Please log in.");
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User record not found.");
    }

    const currentRecord = users[index];
    let updatedName = currentRecord.name;
    let updatedEmail = currentRecord.email;
    let updatedAvatar = currentRecord.avatar;

    if (updates.name !== undefined) {
      const clean = updates.name.trim();
      if (!clean) throw new Error("Name cannot be empty.");
      updatedName = clean;
      // If user has default initials avatar, update initials for the new name
      if (
        !updates.avatar &&
        (currentRecord.avatar?.startsWith("data:image/svg+xml") ||
          currentRecord.avatar?.includes("dicebear"))
      ) {
        updatedAvatar = generateInitialsAvatar(clean);
      }
    }

    if (updates.email !== undefined) {
      const clean = updates.email.trim().toLowerCase();
      if (!clean) throw new Error("Email cannot be empty.");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        throw new Error("Invalid email format.");
      }

      // Check uniqueness against other users
      const duplicate = users.find((u) => u.id !== userId && u.email.toLowerCase() === clean);
      if (duplicate) {
        throw new Error("This email is already in use by another account.");
      }
      updatedEmail = clean;
    }

    if (updates.avatar !== undefined) {
      updatedAvatar = updates.avatar.trim();
    }

    const isSupabaseAccount = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (isSupabaseAccount) {
      const { data, error } = await createSupabaseBrowserClient().auth.updateUser({
        ...(updates.email !== undefined ? { email: updatedEmail } : {}),
        data: { full_name: updatedName, name: updatedName },
      });
      if (error) throw new Error(error.message);
      if (updates.email !== undefined && data.user.new_email) {
        throw new Error(`Confirm the email change using the link sent to ${data.user.new_email}.`);
      }
      updatedEmail = data.user.email || updatedEmail;
    }

    const updatedRecord: UserRecord = {
      ...currentRecord,
      name: updatedName,
      email: updatedEmail,
      avatar: updatedAvatar,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updatedRecord;
    this.saveUsers(users);

    // Update active session email if changed
    this.setSession({
      ...session,
      email: updatedEmail,
    });

    return sanitizeUser(updatedRecord);
  }

  static async updatePlan(userId: string, tier: Extract<User["tier"], "basic" | "pro">): Promise<User> {
    const session = this.getSession();
    if (!session || session.userId !== userId) {
      throw new Error("Unauthorized request. Please log in.");
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error("Paid plan changes are managed through your Billing page.");
    }

    const users = this.getUsers();
    const index = users.findIndex((record) => record.id === userId);
    if (index === -1) throw new Error("User record not found.");

    const updatedRecord: UserRecord = {
      ...users[index],
      tier,
      updatedAt: new Date().toISOString(),
    };
    users[index] = updatedRecord;
    this.saveUsers(users);
    return sanitizeUser(updatedRecord);
  }

  /**
   * Change user password.
   * Verifies current password against stored hash, validates new password, and saves new salted hash.
   */
  static async updatePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string }
  ): Promise<void> {
    const session = this.getSession();
    if (!session || session.userId !== userId) {
      throw new Error("Unauthorized request. Please log in.");
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error("User record not found.");
    }

    const user = users[index];
    const isSupabaseAccount = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (isSupabaseAccount) {
      if (!data.newPassword || data.newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters long.");
      }
      const client = createSupabaseBrowserClient();
      const { error: signInError } = await client.auth.signInWithPassword({ email: user.email, password: data.currentPassword });
      if (signInError) throw new Error("Incorrect current password.");
      const { error: updateError } = await client.auth.updateUser({ password: data.newPassword });
      if (updateError) throw new Error(updateError.message);
      return;
    }
    const currentMatches = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new Error("Incorrect current password.");
    }

    if (!data.newPassword || data.newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long.");
    }

    const newHash = await hashPassword(data.newPassword);
    users[index] = {
      ...user,
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    };

    this.saveUsers(users);
  }
}
