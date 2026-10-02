# Keeper — Rules for AI Coding Agents

*Last Updated: 2026-10-02*

Every AI coding assistant working on the Keeper repository must strictly adhere to this operating contract.

---

## 1. Orientation Before Action
- **Always read [`ai/AI_CONTEXT.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/AI_CONTEXT.md) first** when starting a new session.
- **Read [`ai/CURRENT_STATUS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/CURRENT_STATUS.md) and [`ai/HANDOFF.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/HANDOFF.md)** to understand active work and recent decisions.
- **Inspect actual source code before modifying files**. Do not assume files, APIs, or interfaces exist without verifying.
- **CODE IS THE FINAL TECHNICAL SOURCE OF TRUTH**. The `/ai` documentation is an orientation layer. If documentation differs from code, investigate the code, determine the truth, and update the `/ai` docs. Never change working code merely to match outdated documentation.

---

## 2. Engineering Discipline & Quality Standards
- **Fix Root Causes, Not Symptoms**: Do not add conditional patches or silent catch blocks around architectural bugs. Diagnose the exact writer or transformer causing the issue.
- **Strictly Prohibited**:
  - Never use `@ts-ignore` or `@ts-nocheck`.
  - Never introduce untyped `any` when explicit types can be modeled.
  - Never write empty `catch {}` blocks that silently swallow exceptions.
  - Never mock out or fake production data to bypass tests.
- **Maintain Surgical Change Boundaries**:
  - Do NOT redesign components unless explicitly instructed.
  - Do NOT refactor working providers, deletion logic, or search algorithms when fixing a specific defect.
  - Do NOT re-format entire files; keep diffs clean and readable.

---

## 3. Production Invariants (Non-Negotiable)

1. **Source Data Immutability**:
   - Once authoritative Meta/YouTube export data is imported, source facts (`canonicalUrl`, `creator`, `description`/caption, `savedDate`, `shortcode`, `fbid`) must NEVER be overwritten by weaker remote guest scraping or AI-derived summaries.
   - All updates to `SavedItem` must route through [`ContentService.safeMerge`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L150).
2. **URL Immutability**:
   - The canonical URL of a saved item must never spontaneously change identity (e.g. changing `/reel/ABC/` to `/reel/XYZ/` is a fatal data integrity violation). Only canonical cleaning of the same content (stripping UTM tracking parameters) is allowed.
3. **No Fake Stock Photos**:
   - Never restore Unsplash, Matrix code wallpapers, or generic office photos. If authentic media is unavailable, Keeper displays the honest vector placeholder card (`INSTAGRAM_REEL_PLACEHOLDER`) with `thumbnailSource = "fallback"`.
4. **Graceful Network Degradation**:
   - A network failure or login-wall challenge during ingestion must NEVER cause a valid export bookmark to be rejected or discarded. The item must be stored with available export facts.
5. **Multi-Tenant Isolation**:
   - Cross-user data mutation is strictly forbidden. Collections and items must remain scoped to `userId`.

---

## 4. Post-Change Validation Gate
After making any code modification, you must execute the four validation gates:
```bash
npm run type-check   # 0 errors
npm test             # 100% assertions passing
npm run lint         # 0 warnings / errors
npm run build        # Clean Next.js App Router bundle
```

---

## 5. Documentation Maintenance Protocol
After completing a meaningful code change:
1. Update [`ai/CURRENT_STATUS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/CURRENT_STATUS.md) to reflect working/broken status.
2. Add an entry to [`ai/CHANGELOG_AI.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/CHANGELOG_AI.md) describing the problem, root cause, files modified, and validation results.
3. Update [`ai/HANDOFF.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/HANDOFF.md) with immediate next steps for the next AI agent.
4. Update **only the specific subsystem documentation** affected by your change (e.g. `BULK_IMPORT.md`). Do not rewrite all files unnecessarily.
