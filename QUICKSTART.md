# Distill Quick Start Guide

## Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd distill

# 2. Configure environment
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DISTILL_BASE_URL=http://localhost:3000
DISTILL_SECRET_KEY=<random 32+ character string>
NEXTAUTH_SECRET=<random 32+ character string>
DISTILL_ROOT_USERNAME=admin
DISTILL_ROOT_PASSWORD=<strong password>
DISTILL_ROOT_EMAIL=admin@example.com

# At least one AI provider:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Generate secrets quickly:
```bash
openssl rand -base64 32
```

```bash
# 3. Start with Docker Compose
docker-compose up -d

# 4. Access the application at http://localhost:3000
# Login with the credentials you set in .env
```

---

## Option 2: Local Development

```bash
# 1. Install dependencies and set up in one step
npm run setup

# (or manually:)
npm install
cp .env.example .env   # edit with your settings
mkdir -p data/repos
npx prisma migrate deploy
npm run db:init
npm run dev
```

Open http://localhost:3000

---

## First Steps After Login

1. **Add Your First Repository**
   - Click "Add Repository"
   - Enter a name and HTTPS URL
   - For private repos, provide a personal access token
   - Click "Pull" to fetch the latest code

2. **Create a Chat**
   - Click on a repository
   - Select a branch
   - Click "New Chat"
   - Start asking questions about the code

3. **Configure Personas** *(Admin → Settings → Personas)*
   - Create personas that define the AI's communication style
   - Set Technical Depth, Code Examples, Assumed Knowledge, etc.
   - Mark one as Default — it applies to all new chats automatically

4. **Connect a Datasource** *(Admin → Settings → Datasources)*
   - Add a PostgreSQL connection string
   - Test the connection, then introspect the schema
   - Assign to a repo + branch
   - Grant users query access
   - The AI will include your schema in every chat on that branch

5. **Customize with `.distill.yaml`**
   - Add to your repository root and push
   - Click Pull in Distill to load it
   - Configure AI instructions, context files, branch filters, and structure scanning

---

## Troubleshooting

### Repository Clone Failed
- URL must be HTTPS (not SSH)
- Check that your access token has read permissions
- Ensure the repository exists and is accessible

### Database Errors
- Run `npx prisma migrate deploy` to apply any pending migrations
- Check `DATABASE_URL` in `.env`
- Ensure the `data/` directory exists and is writable

### Chat Not Working
- Verify your AI provider API key is set in `.env`
- Check that you have API credits remaining
- Review logs: `docker-compose logs -f distill`

### Git Operations Failing
- Ensure git is installed (`git --version`)
- Check that `DISTILL_GIT_BASE_PATH` directory is writable

---

## Environment Variables

**Required:**
| Variable | Description |
|---|---|
| `DISTILL_BASE_URL` | Public URL of your instance |
| `DISTILL_SECRET_KEY` | Session + encryption key (32+ chars) |
| `NEXTAUTH_SECRET` | NextAuth secret (32+ chars) |
| `DISTILL_ROOT_USERNAME` | Initial admin username |
| `DISTILL_ROOT_PASSWORD` | Initial admin password |
| `DISTILL_ROOT_EMAIL` | Initial admin email |

**Optional:**
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_AUTO_APPROVE` | Auto-approve Google sign-ins (`true`/`false`) |
| `DATABASE_URL` | SQLite path (default: `file:/data/sqlite.db`) |
| `DISTILL_GIT_BASE_PATH` | Git mirrors path (default: `/data/repos`) |

---

## Production Deployment

1. Use strong secrets (`openssl rand -base64 32` for each)
2. Set `DISTILL_BASE_URL` to your public domain
3. Put Distill behind a reverse proxy (nginx, Caddy) for SSL/TLS
4. Persist the `/data` volume — it contains the database and all git mirrors
5. Backup regularly:
   ```bash
   docker-compose exec distill tar czf /tmp/backup.tar.gz /data
   docker cp distill:/tmp/backup.tar.gz ./backup.tar.gz
   ```

---

## Need Help?

- Full documentation: `README.md`
- Logs: `docker-compose logs -f distill`
- Database inspector: `npx prisma studio`
