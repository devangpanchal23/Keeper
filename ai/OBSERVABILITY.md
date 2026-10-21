# Production monitoring and observability

Last updated: 2026-10-21 10:44 IST

## Application integrations

- The root layout renders exactly one Vercel Web Analytics component and one Speed Insights component, in production only. Both use the official `@vercel/*` Next.js entrypoints.
- In Vercel, enable Web Analytics and Speed Insights for the project. These dashboard switches are separate from the code integration. Check the team's current included event/data-point limits before enabling; overages and Pro add-ons can incur charges. No paid add-on was enabled by this change.
- Deploy after enabling the dashboard features, then check Analytics and Speed Insights in the project dashboard and confirm `/_vercel/insights/*` and `/_vercel/speed-insights/*` requests succeed.

## Server errors and logs

- Next.js `onRequestError` captures uncaught server request failures. The structured logger records operation, route template, error class, and timestamp only. It excludes messages, stacks, query strings, headers, request bodies, user IDs, and database/provider payloads.
- Critical caught failures for billing, ingestion collection sync, AI worker jobs, webhook processing, and media reprocessing use the same redacted logger.
- Vercel Functions/Runtime logs and deployment build logs are available in the Vercel project dashboard. Configure alerts or log drains only if needed; drains may incur additional usage costs and require a destination credential.
- Existing health endpoint reports application/Supabase readiness. Do not expose secret values or detailed provider errors from health checks.

## Dashboard checklist

1. Confirm Production, Preview, and Development environment variables are separately scoped in Project Settings > Environment Variables.
2. Confirm all secret credentials have no `NEXT_PUBLIC_` prefix. Public Supabase URL/key are expected; Supabase publishable/anon keys are designed for browser use with RLS. Keep the service-role key, Razorpay secrets, AI/STT/OCR tokens, worker secret, and OAuth encryption key server-only.
3. Set `TOKEN_ENCRYPTION_KEY` to a unique, high-entropy production secret. The blank template value is intentional and must not be used as a live value.
4. Enable Web Analytics and Speed Insights for the project, review usage limits, and check data after a production deployment.
5. Review deployment notifications, function/runtime logs, failed deployment alerts, and project health checks. Add team-level notifications through Vercel dashboard settings.
6. Review Firewall events and existing rules before making changes. Platform DDoS mitigation is available by default. Custom WAF rules, rate limiting, managed rulesets, log drains, Observability Plus, and add-on entitlements depend on plan or incur separate usage/base charges; verify the current Vercel plan and pricing before enabling.
7. Review caching/CDN behavior in Vercel deployment headers and route configuration before adding cache rules. User-specific API responses must not be publicly cached.

## Environment variable groups

Public browser configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` and optional `NEXT_PUBLIC_SPLINE_HERO_URL`

Server-only credentials/configuration:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `AI_WORKER_SECRET` (or platform-managed `CRON_SECRET` fallback)
- `TOKEN_ENCRYPTION_KEY`
- `YOUTUBE_API_KEY`, `INSTAGRAM_OEMBED_TOKEN`, `META_APP_ACCESS_TOKEN`
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- `CONTENT_AI_API_KEY`, `OPENAI_API_KEY`, `OPENAI_TRANSCRIPTION_API_KEY`
- `WHISPER_SERVICE_TOKEN`, `OCR_SERVICE_TOKEN`

Service URLs and model/provider selectors are configuration, not credentials. Keep private service URLs unprefixed by `NEXT_PUBLIC_` unless the service is deliberately public.

## Validation and remaining external checks

The implementation/test outcomes for this change are recorded in `CURRENT_STATUS.md`, `CHANGELOG_AI.md`, and `HANDOFF.md`. Production dashboard activation, billing-plan entitlements, live endpoint delivery, and real provider/database failures require access to the deployed Vercel project and configured external services. This change does not claim those external checks are complete.
