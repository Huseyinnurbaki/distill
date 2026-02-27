# TODO - Before Open Source Release

## ✅ Recently Completed

- [x] ✅ `.distill.yaml` configuration support
  - AI instructions for repository-specific guidelines
  - Context files auto-included in chats
  - Branch filtering (important/ignore with glob patterns)
  - Smart caching with commit SHA tracking
  - Only rebuilds when files actually change
- [x] ✅ Repository context injection optimization
  - Context injected only on first message (90% token savings)
  - `/update-context` command to refresh mid-conversation
  - Auto inject context toggle in UI
- [x] ✅ Global/Private repositories
  - isGlobal flag on repos
  - Users see their own repos + global repos
  - Toggle to make repos global/private
  - Duplicate URL prevention
- [x] ✅ User management (admin)
  - `/admin/users` page
  - Create users with generated passwords
  - Reset user passwords
  - Approve/Reject pending Google users
  - Delete users (prevents self-deletion)
  - Admin-only access
- [x] ✅ Removed unnecessary features
  - Doc creation (users only view markdown from repos)
  - Pull interval UI (kept in DB for future)
- [x] ✅ File explorer with repository browser
  - Collapsible folder tree
  - File viewer
  - Copy file paths
  - Context info tooltip
- [x] ✅ Chat UX improvements
  - Collapsible chat sidebar
  - Persistent active chat across refreshes
  - Export messages (markdown, PDF, text)
  - Start new chat from responses
  - Command palette (type `/` to see commands)
  - Error message handling
- [x] ✅ Markdown rendering improvements
  - GitHub-style formatting
  - Badge support (shields.io)
  - Details/summary collapsible sections
  - Syntax highlighting
  - File path detection and navigation
- [x] ✅ Branch management
  - Searchable branch dropdown
  - Auto-select primary branch
  - Filter branches based on .distill.yaml
  - Sort by priority (primary → important → alphabetical)
- [x] ✅ UI Polish
  - Favicon with git branch icon
  - robots.txt (disallow all)
  - Context viewer modal on repos page
  - Refresh button on repo cards
  - Proper scrolling on docs/chat pages

---

## Database & Migrations

- [x] ✅ Consolidate Prisma migrations into single `0_init` migration
  - Delete current migration files
  - Create fresh init migration with final schema
  - Test on clean database
- [x] ✅ Add `/prisma/data/` to `.gitignore`
  - Never commit sqlite.db file
  - Users create their own DB on first setup
- [x] ✅ Create database initialization script
  - `npm run db:init` to create admin user (exists in package.json)
  - Auto-create required directories (ensureGitBasePath implemented)
- [ ] Add PostgreSQL support as alternative to SQLite (app database)
  - Update Prisma schema provider to support both SQLite and PostgreSQL
  - Change `contextFileCommits` from `String` to `Json` for PostgreSQL
  - Provide separate docker-compose files:
    - `docker-compose.sqlite.yml` (default, simpler)
    - `docker-compose.postgres.yml` (production-ready, includes postgres service)
  - Environment variable based provider detection via `DATABASE_URL` prefix
  - Separate migration directories for each provider
  - Document trade-offs in README:
    - SQLite: simple, zero config, single file backup
    - PostgreSQL: production-ready, better concurrency, scalable
- [ ] Add MongoDB support as alternative datasource type (external databases)
  - Currently only PostgreSQL is supported as a datasource
  - Add `mongodb` as a `type` option in the Datasource model
  - Install and use `mongodb` npm package for introspection and queries
  - Introspect collections + sample documents to infer schema
  - Read-only enforcement: aggregate/find only, no insert/update/delete
  - Admin UI: show "MongoDB" type badge, adjust connection string hint
  - `.distill.yaml` or datasource config: specify collections to include

## Authentication & Security

- [x] ✅ Root account environment variables testing
  - Test DISTILL_ROOT_USERNAME
  - Test DISTILL_ROOT_PASSWORD
  - Test DISTILL_ROOT_EMAIL
  - Verify admin user creation on first run
  - Document in README with strong password requirements
- [x] ✅ Google Sign-In / OAuth implementation (Option A: Environment Variables) **COMPLETE**
  - [x] Install next-auth package
  - [x] Get Google OAuth credentials from console.cloud.google.com
  - [x] Add to .env and .env.example:
    - NEXTAUTH_SECRET=generated-secret
    - GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
    - GOOGLE_CLIENT_SECRET=GOCSPX-xxx
  - [x] Create /app/api/auth/[...nextauth]/route.ts
    - Configure GoogleProvider
    - Set up callbacks for approval flow
  - [x] Implement Approval Flow (Option 3):
    - New Google users created with isActive: false
    - Add "Pending Approval" status to users table
    - Admin sees pending users in /admin/users
    - Add [Approve] [Reject] buttons for pending users
    - Approved users can access system
    - Clean username generation (email prefix + increment)
  - [x] Update User model:
    - Add authProvider field ("local" | "google")
    - Make passwordHash optional (not needed for OAuth)
  - [x] Update login page:
    - Add "Sign in with Google" button
    - Keep username/password option
    - Show "Pending approval" page for unapproved users
  - [x] Update session management:
    - Integrated NextAuth sessions with existing iron-session
    - Both auth methods work together
  - [x] Document Google OAuth setup in README:
    - How to get credentials
    - How to configure authorized URIs
    - How approval flow works
    - How to approve users
- [ ] Security audit
  - [x] ✅ Review DISTILL_SECRET_KEY generation — throw on short keys, added `openssl rand -hex 32` hint
  - [x] ✅ Ensure tokens are encrypted properly — AES-256-GCM confirmed, no silent key weakening
  - Check session security
  - [x] ✅ HTTPS enforcement in production — handled by reverse proxy/load balancer (out of app scope)
- [x] ✅ Upgrade Next.js from 13.5.x to 15.x
  - Resolved 10+ CVEs (SSRF, DoS, cache poisoning, auth bypass)
  - Migrated next-auth v4 → v5 (beta.30) for async cookies compatibility
  - Updated all API route params to async (`Promise<>` + `await params`)
  - Updated client pages to use React `use(params)` hook
  - `lib/auth.ts` now exports NextAuth v5 `{ handlers, auth, signIn, signOut }`
  - `lib/bcrypt.ts` holds password helpers (split from old `lib/auth.ts`)

## Directory & File Management

- [x] ✅ Directory initialization on startup
  - Auto-create `/data/repos` if missing
  - Auto-create `/data` if missing
  - Set proper permissions
  - Handle permission errors gracefully
- [x] ✅ Git base path configuration
  - Verify DISTILL_GIT_BASE_PATH works correctly
  - Test with custom paths
  - Document in README

## Docker & Deployment

- [x] ✅ Dockerfile optimized
  - Multi-stage build for smaller image (~50% size reduction)
  - Security best practices (non-root user)
  - Runs as user 'nextjs' (UID 1001)
  - Health check integrated
  - Proper permissions on /data
- [x] ✅ Docker Compose configuration
  - Volume mounts for /data
  - All environment variables configured
  - Health check configured (30s interval)
  - Restart policy: unless-stopped
  - Required env vars validation
- [x] ✅ .dockerignore optimized
  - Excludes development files
  - Excludes data directories
  - Smaller build context
- [ ] Docker volumes documentation
  - `/data` volume for database
  - `/data/repos` volume for git mirrors
  - Persistent storage requirements
  - Backup recommendations (add to README)

## API & Features

- [x] ✅ Create health check endpoint
  - `/api/health` for Docker healthcheck
  - Check database connection
  - Check file system access
  - Return status and timestamp
- [x] ✅ Health check endpoint
  - `/api/health` checks database and filesystem
  - Returns 200 (healthy) or 503 (unhealthy)
  - Integrated with Docker health checks
- [ ] API documentation
  - Document all endpoints
  - Request/response examples
  - Authentication requirements
- [ ] Rate limiting
  - Protect API endpoints
  - Prevent abuse
  - Configure limits

## User Experience

- [ ] Error handling improvements
  - Better error messages
  - User-friendly errors
  - Log errors for debugging
- [ ] Loading states
  - Consistent loading indicators
  - Skeleton screens
  - Progress feedback
- [ ] Onboarding
  - First-time user guide
  - Example repository suggestion
  - Quick start wizard

## Documentation

- [ ] README improvements
  - Installation guide
  - Configuration guide
  - Troubleshooting section
  - Contributing guidelines
- [x] ✅ Environment variables documentation
  - All required variables (in .env.example)
  - All optional variables (in .env.example)
  - Example .env file (complete and up to date)
  - [x] ✅ Security best practices (add to README)
- [ ] Architecture documentation
  - System overview
  - Component diagram
  - Data flow
  - Tech stack details
- [ ] Deployment guides
  - Docker deployment
  - Docker Compose deployment
  - ECS deployment

## Testing

- [ ] Unit tests
  - API endpoints
  - Utility functions
  - Auth logic
- [ ] Integration tests
  - End-to-end flows
  - Database operations
  - Git operations
- [ ] Security testing
  - Penetration testing
  - Dependency audit
  - OWASP top 10 check

## Code Quality

- [ ] Code cleanup
  - Remove console.logs (or use proper logging)
  - Remove debug code
  - Remove commented code
  - Consistent formatting
- [ ] TypeScript strict mode
  - Enable strict checks
  - Fix any type issues
  - Remove any 'any' types
- [x] ✅ Linting
  - Configure ESLint rules (Next.js defaults)
  - Fix all warnings (useCallback, exhaustive-deps)
  - Consistent code style

## Performance

- [ ] Optimize bundle size
  - Code splitting
  - Lazy loading
  - Remove unused dependencies
- [x] ✅ Database optimization
  - Add indexes where needed (added for userId, isGlobal, etc.)
  - Optimize queries
  - Connection pooling
- [x] ✅ Caching strategy
  - Cache repository context (implemented with commit SHA tracking)
  - Cache branch lists
  - Cache file trees

## Legal & Licensing

- [x] ✅ Choose license (PolyForm Noncommercial 1.0.0 — prevents commercial use)
- [x] ✅ Add LICENSE file
- [ ] Add CONTRIBUTING.md
  - Contribution guidelines
  - Code of conduct
  - Pull request process
- [ ] Add CHANGELOG.md
  - Version history
  - Breaking changes
  - Migration guides

## Release Preparation

- [ ] Version numbering
  - Semantic versioning
  - Tag releases
  - Release notes
- [ ] GitHub repository setup
  - Repository description
  - Topics/tags
  - Issue templates
  - PR templates
- [x] CI/CD pipeline
  - Automated testing
  - Docker image builds
  - Automated releases

## Future Features (Post-Release)

- [ ] Quick questions UI (from .distill.yaml)
- [ ] Chat presets UI (from .distill.yaml)
- [x] ✅ User management UI (basic implementation complete)
  - Admin page at /admin/users
  - List users in table
  - Create users
  - Reset passwords
  - [ ] Edit user (not yet)
  - [x] ✅ Delete user with safeguards (prevents self-deletion)
  - [ ] User activity logs (not yet)
- [ ] Token usage tracking
  - Both APIs emit token counts in streaming (currently ignored)
  - Anthropic: `message_delta` event has `usage.input_tokens` / `usage.output_tokens`
  - OpenAI: pass `stream_options: { include_usage: true }` to get final usage chunk
  - Store `inputTokens` / `outputTokens` on the `Message` model (schema migration needed)
  - Show per-chat total in the UI (e.g. chat header/footer) rather than per-message
  - Optionally add aggregate stats to admin page
- [ ] Repository analytics
  - Usage statistics
  - Popular queries
  - AI model usage
- [ ] Webhook support
  - Auto-pull on git push
  - Notifications
- [ ] Multi-repo context
  - Chat across multiple repos
  - Cross-repo references
- [ ] Ticket system integration (pull context into chat)
  - Linear: pull issue details, project context, linked PRs
  - GitHub Issues / Jira / Notion (extensible)
  - `.distill.yaml` config to link a workspace/project
  - In chat: `/ticket ABC-123` fetches and injects ticket as context
  - AI uses ticket description + comments to give more relevant answers
  - Create ticket from chat (e.g. turn AI response into a Linear issue)
- [ ] Datasource query permission levels
  - Currently only SELECT/WITH is allowed globally
  - Per-datasource config: allow SELECT only, or also DELETE, INSERT, UPDATE
  - Admin sets allowed operations when creating/editing a datasource
  - UI shows which operations are permitted (e.g. "Read-only" vs "Read/Write")
  - Enforced server-side in `/api/datasources/[id]/query`

---

**Priority Legend:**

- High: Must have before release
- Medium: Should have
- Low: Nice to have

**Estimated Timeline:**

- High priority items: 2-3 weeks
- Medium priority: 1-2 weeks
- Low priority: Post v1.0

reinit repo, push branchs latest
