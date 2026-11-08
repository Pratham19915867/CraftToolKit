# CraftToolkit

CraftToolkit is a Cloudflare Workers application with static frontend assets, a Supabase PostgreSQL database, username/password authentication, a template library, saved scripts, and an OpenAI-compatible Skript generator.

> **Compatibility note:** Minecraft Skript and addon syntax varies by version. Templates are starter examples, not universal guarantees. Test on a backup server before production. Some examples may require adjustment for your installed Skript build/addons.

## Requirements

- Node.js (20+ recommended; Node 26 should work with Wrangler)
- npm
- Cloudflare account
- Supabase project
- OpenAI-compatible API key for AI generation (optional; AI route returns 503 if not configured)

## 1. Install Node.js

Install Node.js from https://nodejs.org/. Open **Windows CMD** or **PowerShell** and check:

```bat
node -v
npm -v
```

## 2. Create Supabase project

1. Create a project at https://supabase.com/.
2. Wait for database provisioning.
3. Open **SQL Editor → New query**.
4. Paste all contents of `supabase/schema.sql`.
5. Run it.
6. Open **Project Settings → API** (or API Keys) and copy the Project URL and `service_role` key. The service role key is highly privileged.

This app uses the Worker service role for all database operations. RLS is enabled on every table, with no anon/authenticated policies. Do not put the service role key in frontend code, git, screenshots, or public issue reports.

## 3. Configure secrets

Copy `.dev.vars.example` to `.dev.vars`:

**CMD**
```bat
copy .dev.vars.example .dev.vars
```

**PowerShell**
```powershell
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role secret key.
- `SESSION_SECRET`: random secret of 32+ characters (included as a deployment secret/config value for future signing; current sessions are random opaque tokens hashed in DB).
- `AI_API_KEY`: API key for your AI provider (optional).
- `AI_BASE_URL`: OpenAI-compatible API base URL, default `https://api.openai.com/v1`.
- `AI_MODEL`: model name, default `gpt-4o-mini`.
- `APP_ORIGIN`: exact local/deployed origin. For local use `http://localhost:8787`; production set your deployed domain.

**Important:** Never commit `.dev.vars`. It is ignored by `.gitignore`.

## 4. Install dependencies

In the project directory:

```bat
npm install
```

This project uses Wrangler only; it does **not** use SQLite, `better-sqlite3`, Express, or native compilation packages.

## 5. Run locally

```bat
npm run dev
```

Wrangler serves the app at http://localhost:8787. Test:

- `GET /api/health`
- Registration / login
- Template search, preview, copy, download
- Save script and dashboard
- AI generation (requires AI key)

Use browser DevTools Network to inspect API responses. Do not paste secrets into DevTools or issue reports.

## 6. Deploy to Cloudflare Workers

Authenticate:

```bat
npx wrangler login
```

Set production secrets (Wrangler prompts securely):

```bat
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put AI_API_KEY
```

Optional AI settings can be configured as Worker vars in `wrangler.toml` or dashboard. For production, update `APP_ORIGIN` in `wrangler.toml` to your exact site origin, e.g. `https://crafttoolkit.example.com`.

Dry-run and deploy:

```bat
npm run check
npm run deploy
```

Wrangler prints the `workers.dev` URL. Visit it and test the API and UI.

### Dashboard method for secrets

Cloudflare Dashboard → **Workers & Pages** → your Worker → **Settings → Variables and Secrets**. Add secrets (not plain-text vars) for `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and `AI_API_KEY`. Add `SUPABASE_URL` as a variable or secret. Save and redeploy if prompted.

## 7. Custom domain

1. Add your domain to Cloudflare DNS (if not already).
2. Workers & Pages → CraftToolkit Worker → **Settings → Domains & Routes**.
3. Add a custom domain and follow Cloudflare's DNS/TLS instructions.
4. Set `APP_ORIGIN` to the exact HTTPS origin, such as `https://toolkit.yourdomain.com`.
5. Redeploy (`npm run deploy`).

The session cookie is `HttpOnly; Secure; SameSite=Lax`. On local Wrangler, HTTPS cookie behavior can differ; test production on HTTPS.

## API overview

| Route | Auth | Description |
|---|---|---|
| `GET /api/health` | No | Health check |
| `POST /api/auth/register` | No | Register username/password |
| `POST /api/auth/login` | No | Login |
| `POST /api/auth/logout` | Session | Revoke session |
| `GET /api/auth/me` | Cookie | Current user |
| `GET /api/templates` | No | Template metadata |
| `GET /api/templates/:id` | No | Full template/code |
| `GET /api/scripts` | Session | List own scripts |
| `POST /api/scripts` | Session | Save own script |
| `DELETE /api/scripts/:uuid` | Session | Delete own script |
| `POST /api/ai/generate` | Session | Generate Skript |

All API responses are JSON. API errors are returned with an `error` field.

## Database and access model

- `profiles`: username and PBKDF2 password hash.
- `sessions`: hashed opaque session token, expiry and user foreign key.
- `saved_scripts`: scripts owned by a user.
- `templates`: optional DB table for future curated template storage; current template catalog is bundled in Worker source.
- `user_preferences`: reserved for theme/preferences persistence.

Worker uses the Supabase service role and enforces ownership in server-side query filters. RLS is enabled as defense-in-depth, but service-role calls bypass RLS. **Never expose service-role credentials.** No direct browser Supabase calls are used.

## Required secrets / variables

| Name | Where | Required |
|---|---|---|
| `SUPABASE_URL` | `.dev.vars`; Worker secret/variable | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `.dev.vars`; Cloudflare Worker Secret | Yes |
| `SESSION_SECRET` | `.dev.vars`; Cloudflare Worker Secret | Yes (configured; current session tokens are opaque random values) |
| `AI_API_KEY` | `.dev.vars`; Cloudflare Worker Secret | AI generation only |
| `AI_BASE_URL` | Wrangler var or `.dev.vars` | Optional |
| `AI_MODEL` | Wrangler var or `.dev.vars` | Optional |
| `APP_ORIGIN` | Wrangler var or `.dev.vars` | Set exact origin |

## Troubleshooting

- **`Supabase secrets are not configured`**: check `.dev.vars` locally and Worker secrets after deployment.
- **Supabase 401/403**: verify URL/key pair; make sure it is the service role key, not anon. Keep it private.
- **Registration conflict**: usernames are case-insensitive and unique; choose another.
- **Login fails**: username/password are case-sensitive for password, username lookup is case-insensitive.
- **Cookie/session not persisting**: production must use HTTPS. Check `APP_ORIGIN`, browser cookie settings and Cloudflare Worker domain.
- **Origin not allowed**: set `APP_ORIGIN` to exact origin including scheme and port (local: `http://localhost:8787`).
- **AI 503**: configure `AI_API_KEY`.
- **AI 502**: verify `AI_BASE_URL`, model name and provider quota.
- **Skript parse errors**: match your Skript and addon versions, remove unsupported syntax, and test on a backup.
- **Wrangler install issue**: use a supported Node LTS release if a toolchain-specific problem occurs; this project itself has no native dependencies.
- **Cloudflare 404 for API**: ensure `run_worker_first = ["/api/*"]` remains configured in `wrangler.toml`.

## Security notes / production hardening

- This is a starter app; do a security review before public production use.
- Registration/login and AI requests use Cloudflare Worker Rate Limiting bindings (`AUTH_LIMITER`, `AI_LIMITER`) configured in `wrangler.toml` (10 auth requests/IP/minute and 5 AI requests/IP/minute). These are edge limits, not a complete anti-bot solution; add Turnstile and abuse monitoring before public launch.
- Consider Supabase Auth or a mature auth service if you need email recovery, MFA, account recovery, or abuse controls.
- Add a CSP and stricter security headers, audit dependency updates, and monitor logs.
- Username-only authentication has no password reset path. Users who forget their password cannot self-recover in this starter version.
- `SESSION_SECRET` is provisioned for future cryptographic use, but current sessions use cryptographically random bearer tokens stored as SHA-256 hashes. Rotate/revoke sessions if the database is compromised.
