# Self-hosted deployment notes

This fork (`alru/ViewComfy`) contains modifications for running ViewComfy
on a self-hosted server with a local ComfyUI instance, without ViewComfy Cloud.

## Fork relationship

| Remote     | URL                                        | Purpose                    |
|------------|--------------------------------------------|----------------------------|
| `origin`   | https://github.com/alru/ViewComfy.git      | This fork (deploy from)    |
| `upstream` | https://github.com/ViewComfy/ViewComfy.git | Original repo (sync from)  |

### Syncing with upstream

```bash
git fetch upstream
git merge upstream/main
# resolve conflicts if any, then push
git push origin main
```

## Changes from upstream

### 1. Optional cloud WebSocket (`lib/socket.ts`, `app/providers/socket-provider.tsx`)

**Problem:** The original code throws at module load time if
`NEXT_PUBLIC_CLOUD_WS_URL` is not set. This crashes the Playground page
even in local mode, where the cloud socket is never used.

**Fix:** `socket` is exported as `Socket | null`. When the env variable is
absent, the socket is `null` and all consumers (socket-provider, hooks)
skip initialization gracefully. Cloud functionality still works when the
variable is provided.

### 2. Clerk authentication removed

**Problem:** The upstream project uses Clerk (`@clerk/nextjs`) for user
authentication. Even with `NEXT_PUBLIC_USER_MANAGEMENT="false"`, Clerk
required valid API keys at initialization — without them every route
returned 500.

**Fix:** `@clerk/nextjs` is fully removed from dependencies. All imports
are replaced with `lib/clerk-shim.ts` — a local file providing no-op
stubs for `useAuth`, `useUser`, `SignedIn`, `UserButton`, and `SignIn`.
The middleware is a simple pass-through (`NextResponse.next()`).
No Clerk account or API keys are needed.

To re-enable Clerk: delete `lib/clerk-shim.ts`, restore `@clerk/nextjs`
in `package.json`, and replace all `@/lib/clerk-shim` imports back to
`@clerk/nextjs` (search the codebase for `clerk-shim`).

### 3. `.env` removed from git tracking (`.gitignore`)

**Problem:** `.env` was tracked by git. Running `git pull` or
`git reset --hard` on the server would overwrite server-specific
configuration (secrets, paths, feature flags).

**Fix:** Added `.env` to `.gitignore` and removed it from tracking.
Each deployment maintains its own `.env` independently.

## Server architecture

```
Internet
  │
  ├── :80   → NGINX (basic auth) → 127.0.0.1:8188  (ComfyUI)
  └── :3080 → NGINX              → 127.0.0.1:3000  (ViewComfy / Next.js)
```

ViewComfy communicates with ComfyUI server-side via `COMFYUI_API_URL`.
External users interact only with ViewComfy through NGINX.

## Server .env configuration

For local-only deployment (no ViewComfy Cloud):

```env
COMFY_OUTPUT_DIR="/path/to/ComfyUI/output"
COMFYUI_API_URL="127.0.0.1:8188"
COMFYUI_SECURE="false"

# Disable cloud and user management
NEXT_PUBLIC_USER_MANAGEMENT="false"
NEXT_PUBLIC_VIEW_COMFY_CLOUD="false"
NEXT_PUBLIC_VIEW_MODE="false"

# Cloud settings — commented out, not needed for local deployment
#NEXT_PUBLIC_CLOUD_WS_URL="http://localhost:8000"
#NEXT_PUBLIC_API_URL="http://your-server:3080"
```

## Deploying updates

On the server:

```bash
cd ~/apps/viewcomfy
git pull origin main
npm run build          # required for any NEXT_PUBLIC_* changes
sudo systemctl restart viewcomfy
```

Note: `NEXT_PUBLIC_*` variables are embedded at build time. Server-side
variables (without the prefix) take effect after a service restart only.

## Server management

```bash
sudo systemctl status viewcomfy
sudo systemctl restart viewcomfy
sudo journalctl -u viewcomfy -f          # live logs
sudo journalctl -u viewcomfy -n 50       # last 50 lines
```
