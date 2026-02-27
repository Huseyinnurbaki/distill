# Distill

A self-hosted, branch-aware, commit-aware AI intelligence layer for Git repositories.

## Features

- **Branch & Commit Awareness**: Every chat is tied to a specific branch and commit SHA
- **Snapshot Chats**: Chat with a specific branch snapshot
- **Compare Chats**: Compare two branches side-by-side
- **Read-Only Access**: HTTPS-only, read-only repository access
- **Multiple AI Providers**: Support for OpenAI and Anthropic
- **Self-Hosted**: Fully containerized, no external dependencies except AI APIs
- **Local Auth**: Simple username/password authentication
- **Markdown Docs**: Publish documentation tied to specific commits
- **Structure Explorer**: Auto-scan and visualize your repository's routes and database schema
- **Schema Viewer**: Interactive board for exploring database models and their relations
- **Personas**: Define AI response styles (technical depth, code examples, assumed knowledge) and assign one per chat
- **Live Datasources**: Connect PostgreSQL databases to chats — AI sees the real schema, generates SQL, and users run queries inline

## Tech Stack

- Next.js (App Router)
- TypeScript
- Prisma ORM
- SQLite (file-based)
- Tailwind CSS
- Docker

## Quick Start with Docker

1. Clone this repository
2. Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

3. Set your API keys in `.env`:

   ```env
   DISTILL_SECRET_KEY=your-secret-key-minimum-32-characters-long
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Build and run with Docker Compose:

   ```bash
   docker-compose up -d
   ```

5. Access Distill at `http://localhost:3000`

6. Login with default credentials (change after first login):
   - Username: `admin`
   - Password: `admin`

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up the database:

   ```bash
   mkdir -p data/repos
   npx prisma migrate deploy
   ```

3. Create admin user:

   ```bash
   npm run db:init
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable                | Description                                            | Required |
| ----------------------- | ------------------------------------------------------ | -------- |
| `DISTILL_ENV`           | Environment (production/development)                   | Yes      |
| `DISTILL_BASE_URL`      | Base URL of the application                            | Yes      |
| `DISTILL_SECRET_KEY`    | Secret key for session encryption (32+ chars)          | Yes      |
| `NEXTAUTH_URL`          | NextAuth base URL (same as DISTILL_BASE_URL)           | Yes      |
| `NEXTAUTH_SECRET`       | NextAuth secret key (32+ chars)                        | Yes      |
| `GOOGLE_CLIENT_ID`      | Google OAuth Client ID                                 | Optional |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth Client Secret                             | Optional |
| `DATABASE_URL`          | SQLite database path (default: `file:/data/sqlite.db`) | Optional |
| `DISTILL_ROOT_USERNAME` | Root admin username                                    | Yes      |
| `DISTILL_ROOT_PASSWORD` | Root admin password                                    | Yes      |
| `DISTILL_ROOT_EMAIL`    | Root admin email                                       | Yes      |
| `DISTILL_GIT_BASE_PATH` | Path for storing git mirrors (default: `/data/repos`)  | Optional |
| `OPENAI_API_KEY`        | OpenAI API key                                         | Optional |
| `ANTHROPIC_API_KEY`     | Anthropic API key                                      | Optional |

## Google Sign-In Setup (Optional)

Distill supports Google OAuth for user authentication with an admin approval flow.

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API" (in APIs & Services)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Add authorized redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy the Client ID and Client Secret

### 2. Configure Environment Variables

Add to your `.env` file:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-32-character-secret
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

### 3. How It Works

**Approval Flow:**

1. User clicks "Sign in with Google" on login page
2. After Google authentication, account is created with **status: Pending**
3. User sees "Pending Approval" page
4. Admin goes to **Manage Users** → Sees pending users
5. Admin clicks **[Approve]** → User can now access Distill
6. Admin can set user as Admin or regular User

**Benefits:**

- ✅ Secure - No random access
- ✅ Admin controls who gets in
- ✅ Works alongside username/password login
- ✅ Self-service user requests

## Usage

### Adding a Repository

1. Click "Add Repository" on the repos page
2. Enter repository name and HTTPS URL
3. For private repos, provide an access token
4. Choose default branch (or auto-detect)
5. Set pull interval

### Creating Chats

**Snapshot Chat:**

1. Select a branch
2. Click "New Chat"
3. Start asking questions about the code

**Compare Chat:**

1. Click "Compare" button
2. Select two branches to compare
3. AI will help explain differences

### Personas

Personas let you control how the AI responds — useful for different audiences (e.g., a senior engineer vs. a new hire).

**Managing Personas (Admin):**

1. Go to **Admin → Settings**
2. In the **Personas** section, click **Add Persona**
3. Configure sliders: Technical Depth, Code Examples, Assumed Knowledge, Business Context, Response Detail
4. Mark one persona as **Default** — it's applied to all new chats automatically

**Using Personas in Chat:**

- A persona chip appears in the chat header showing the active persona
- Click it to switch to a different persona mid-chat
- The AI adjusts its response style immediately

---

### Datasources

Connect a live PostgreSQL database to a repo so the AI can answer data questions alongside code questions.

**Setup (Admin):**

1. Go to **Admin → Settings** → **Datasources** → **Add Datasource**
2. Enter the connection string (stored encrypted at rest)
3. Click **Test Connection** to verify
4. Click **Manage** to open the datasource detail page:
   - **Assignments** — assign to a repo + branch (each branch can represent an environment)
   - **User Access** — grant specific users permission to execute queries
   - **Data Dictionary** — define business terms (e.g., "Tesla" → UUID in companies table) so the AI generates precise queries
   - **Re-introspect Schema** — refresh the cached schema from the live DB (also triggered automatically on every Pull)

**In Chat:**

- When a datasource is assigned to the repo+branch, a 🗄 chip appears in the chat header
- The AI receives the full table/column schema and data dictionary on every message
- When the AI generates a SQL query, a **Run** button appears below the code block
- Running a query shows row count inline and opens a result panel with **Table / SQL / Raw** tabs and a CSV export option
- Use the `/db` slash command to switch the active datasource (when multiple are assigned to the branch)

---

### Structure Explorer

The Structure tab (inside any repo's chat view) scans your codebase and displays:

- **Routes** — all Next.js pages (or a React routes file) with AI-generated one-line descriptions
- **Schema** — all Prisma or SQL database models with fields

**To enable:**

1. Add a `structure` section to your `.distill.yaml` (see below)
2. Commit and push, then click **Pull** in Distill
3. In the Structure tab click **Scan** — routes and schema are scanned and cached

**Change detection:** Distill re-runs AI descriptions only when the source files actually change (tracked by commit SHA). Force a full rescan with the orange button (admins only).

**Schema Viewer:** Click the external-link icon next to any schema to open the interactive board in a new window. Select a model from the chip bar to see it and its relations on the canvas. Use scroll or `+`/`-` to zoom, drag to pan.

### Using .distill.yaml

Customize how the AI understands and interacts with your repository by adding a `.distill.yaml` file.

**Important:** Distill is **read-only**. Add this file to your repository directly (GitHub, GitLab, etc.), commit and push it, then click "Pull" in Distill to load the configuration.

#### Configuration Format

```yaml
# AI Behavior Rules - Applied to every chat
ai_instructions:
  - "Files in /deprecated are legacy code - don't suggest using them"
  - "Use TypeScript, not JavaScript for new code"
  - "Always include error handling in suggestions"
  - "Follow the patterns shown in /examples directory"

# Context Files - Automatically included in every chat
context_files:
  - "README.md"
  - "docs/architecture.md"
  - "CONTRIBUTING.md"
  - "docs/api-reference.md"

# Branch Management
branches:
  important: # Show these after primary branch, in this order
    - "develop"
    - "staging"
    - "production"
  ignore: # Filter these out (supports glob patterns)
    - "dependabot/*"
    - "renovate/*"
    - "snyk-*"
    - "temp-*"

# Quick Questions
quick_questions:
  - "How do I get started?"
  - "What's the architecture?"
  - "How do I run tests?"

# Structure scanning
structure:
  frontend:
    routing:
      type: nextjs # or 'react' for a routes file
      directory: app # scan this directory for page files
  database:
    schemas:
      - prisma/schema.prisma # Prisma schema
      - db/schema.sql # or raw SQL
```

#### How It Works

**Setup (One Time):**

1. In your repository (GitHub/GitLab/etc.), add `.distill.yaml` to the root
2. Commit and push to your repository
3. In Distill, click "Pull" button
4. ✅ Configuration loaded!

**Every Pull After That:**

1. Distill checks commit SHAs of:
   - `.distill.yaml` itself
   - All files in `context_files`
2. **If ANY file changed** → Rebuilds and caches context
3. **If nothing changed** → Skips rebuild (fast!)
4. Context is cached and shared across all users

**What Gets Cached:**

- AI instructions from yaml
- Full content of all context files (README, docs, etc.)
- File commit SHAs for change detection

**In Every Chat:**

- AI receives your `ai_instructions` as behavioral guidelines
- AI has full content of all `context_files` (README, docs, etc.)
- AI knows the repository structure

**Branch Filtering:**

- Primary branch (main/master) shows first
- Important branches listed next (in your specified order)
- Branches matching `ignore` patterns are filtered out

**Remember:** Distill is read-only - it only reads your repository, never modifies it.

#### Field Descriptions

| Field                        | Type     | Description                                                                  |
| ---------------------------- | -------- | ---------------------------------------------------------------------------- |
| `ai_instructions`            | string[] | Rules and guidelines for AI behavior in this repo                            |
| `context_files`              | string[] | Paths to files that should be included in every chat (relative to repo root) |
| `branches.important`         | string[] | Branches to show after primary, in this order                                |
| `branches.ignore`            | string[] | Branch patterns to filter out (supports glob: `dependabot/*`)                |
| `quick_questions`            | string[] | Pre-defined questions shown as shortcuts                                     |
| `structure.frontend.routing` | object   | Routing scanner config (`type`, `directory` or `routes_file`)                |
| `structure.database.schemas` | string[] | Paths to Prisma or SQL schema files to scan                                  |

#### Best Practices

**Context Files:**

- ✅ Include README and architecture docs
- ✅ Keep it focused (2-5 key files)
- ✅ Use relative paths from repo root
- ✅ Avoid large files (token limits)

**AI Instructions:**

- ✅ Mention deprecated directories
- ✅ Specify coding standards
- ✅ Highlight important patterns
- ✅ Keep instructions clear and specific

**Branch Filtering:**

- ✅ Ignore automated PR branches (dependabot, renovate)
- ✅ List important branches in logical order
- ✅ Use glob patterns for flexibility

#### Example for a TypeScript Project

```yaml
ai_instructions:
  - "Use TypeScript strict mode - no 'any' types"
  - "Components in /src/components/ui are from shadcn/ui - don't modify them"
  - "API routes follow REST conventions in /app/api"
  - "Tests go in __tests__ directories, use Jest"

context_files:
  - "README.md"
  - "docs/ARCHITECTURE.md"
  - "CONTRIBUTING.md"

branches:
  important:
    - "develop"
    - "staging"
  ignore:
    - "dependabot/*"
    - "renovate/*"

structure:
  frontend:
    routing:
      type: nextjs
      directory: app
  database:
    schemas:
      - prisma/schema.prisma
```

#### No .distill.yaml?

If no `.distill.yaml` file exists, Distill works normally without custom configuration. The file is **completely optional**.

## Data Persistence

All data is stored in the `/data` volume:

- `/data/sqlite.db` - SQLite database
- `/data/repos` - Git repository mirrors

`DATABASE_URL` and `DISTILL_GIT_BASE_PATH` default to these paths in the Docker image, so you don't need to set them unless you want to override the location.

### AWS ECS (EC2 launch type)

Use a **bind mount** volume pointing to a directory on the EC2 instance:

- **Source path** (EC2 host): `/home/ec2-user/distill-data`
- **Container path**: `/data`

The container automatically creates `/data/repos` and sets correct permissions on startup — no manual setup required. The SQLite database is created automatically on first start.

## Security Notes

- Change default admin credentials immediately
- Use strong `DISTILL_SECRET_KEY` (32+ characters)
- Repository tokens are encrypted at rest
- Datasource connection strings are encrypted at rest (AES-256-GCM)
- Only HTTPS git URLs are allowed
- All repositories are read-only
- Datasource queries are restricted to `SELECT` / `WITH` — writes are rejected

## API Routes

- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/repos` - List repositories
- `POST /api/repos` - Add repository
- `GET /api/repos/:id` - Get repository details
- `POST /api/repos/:id/pull` - Trigger fetch (also triggers structure scan)
- `GET /api/repos/:id/branches` - List branches
- `GET /api/repos/:id/chats` - List chats
- `POST /api/repos/:id/chats` - Create snapshot chat
- `POST /api/repos/:id/compare-chats` - Create compare chat
- `POST /api/chats/:chatId/messages` - Send message (SSE stream)
- `GET /api/repos/:id/structure` - Get stored structure data (routes + schemas)
- `POST /api/repos/:id/structure/scan` - Trigger structure scan (`{ force: boolean }`)
- `GET /api/repos/:id/schema?branch=` - Read schema live from git for any branch
- `GET /api/repos/:id/datasources?branch=` - List datasources assigned to this repo+branch (with `canExecute` flag)
- `POST /api/datasources/:id/query` - Execute a SELECT query against a datasource
- `GET /api/personas` - List all personas
- `GET /api/admin/datasources` - List all datasources (admin)
- `POST /api/admin/datasources` - Create datasource (admin)
- `GET/PATCH/DELETE /api/admin/datasources/:id` - Manage datasource (admin)
- `POST /api/admin/datasources/:id/test` - Test connection (admin)
- `POST /api/admin/datasources/:id/introspect` - Re-introspect schema (admin)
- `GET/POST /api/admin/datasources/:id/assignments` - Manage repo+branch assignments (admin)
- `DELETE /api/admin/datasources/:id/assignments/:assignmentId` - Remove assignment (admin)
- `GET/POST /api/admin/datasources/:id/access` - Manage user access (admin)
- `DELETE /api/admin/datasources/:id/access/:accessId` - Revoke user access (admin)
- `GET/POST /api/admin/datasources/:id/dictionary` - Manage data dictionary (admin)
- `PATCH/DELETE /api/admin/datasources/:id/dictionary/:entryId` - Edit dictionary entry (admin)
- `GET/POST/PATCH/DELETE /api/admin/personas` - CRUD for personas (admin)

## License

Distill is open source under the Apache License 2.0.

See the [LICENSE](./LICENSE) file for details.
