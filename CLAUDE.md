# X Forwarder - Development Guidelines

This document contains instructions and guidelines for development work on the X Forwarder project.

## ⚠️ CRITICAL: ALWAYS BUILD BEFORE COMMIT

**THIS IS NON-NEGOTIABLE:** You MUST run `npm run build` and verify it passes successfully BEFORE every commit.

### Why This Is Absolutely Critical

- **Failed builds break production** - Vercel deployments will fail
- **Wastes time** - Build errors caught locally are 10x faster to fix than in CI/CD
- **Breaks the team** - Other developers can't work on a broken codebase
- **Prevents deployment** - You cannot deploy if the build fails

### The One Rule

```bash
# ALWAYS run this before git commit:
npm run build

# Only if this succeeds ✓, then:
git add .
git commit -m "Your message"
git push
```

## Build and Deployment Policy

### Pre-Deployment Checklist

**MANDATORY:** Always follow these steps before committing and deploying code:

1. **Generate Prisma Client** (if schema changed):
   ```bash
   npx prisma generate
   ```

2. **Run Build** (ALWAYS, EVERY TIME):
   ```bash
   npm run build
   ```

3. **Verify Build Success**:
   - Build must complete without errors
   - Check for TypeScript type errors
   - Review any build warnings
   - If build fails, FIX IT before committing

4. **Only After Successful Build**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push
   ```

### Why This Matters

- Vercel deployments will fail if the build fails
- TypeScript errors prevent production deployment
- Prisma Client must be generated before building
- Failed deployments waste time and resources
- Build errors caught locally are faster to fix than in CI/CD

### Common Build Issues

1. **Module Not Found Errors**:
   - **Problem**: `Module not found: Can't resolve '@/lib/...'`
   - **Cause**: Deleted a file but other files still import it
   - **Solution**:
     - Search for all imports: `grep -r "from '@/lib/deleted-file'" src/`
     - Remove or replace all references to the deleted file
     - Run `npm run build` to verify

2. **Prisma Client Not Found**:
   - Solution: Run `npx prisma generate`
   - Add `src/generated/prisma/index.ts` if missing

3. **TypeScript Type Errors**:
   - Array.find() returns `undefined`, not `null`
   - Don't use `|| null` with find operations
   - Check return types match expected types

4. **Prisma Version Issues**:
   - Use Prisma 6.x (not 7.x which has engine issues)
   - Ensure DATABASE_URL is in datasource block

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL 15.15 (AWS RDS)
- **ORM**: Prisma 6.19.1 (pinned to avoid v7 issues)
- **Authentication**: NextAuth.js v4
- **API**: Twitter API v2

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── projects/              # Multi-project management
│   │   ├── auth/                  # OAuth flows
│   │   ├── webhooks/              # Twitter webhook receiver
│   │   └── twitter/               # Tweet publishing
│   └── dashboard/                 # UI
├── lib/
│   ├── db/                        # Database operations
│   ├── twitter/                   # Twitter API calls
│   └── utils/                     # Utilities (encryption, etc)
└── generated/
    └── prisma/                    # Generated Prisma Client
```

## Database Schema

See `prisma/schema.prisma` for the complete schema. Key models:

- **Project**: Multi-tenant container for bots and configs
- **Bot**: Twitter bot account with encrypted OAuth tokens
- **ForwardingConfig**: Webhook forwarding endpoints
- **WebhookRegistration**: Twitter webhook subscriptions

## Development Workflow

1. Make code changes
2. If schema changed: `npx prisma generate`
3. Test locally: `npm run dev`
4. Type check: `npm run type-check`
5. Build: `npm run build`
6. Commit and push only if build succeeds
7. Monitor Vercel deployment logs

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Production build
npm run type-check         # TypeScript checking

# Database
npx prisma generate        # Generate Prisma Client
npx prisma migrate dev     # Run migrations (dev)
npx prisma migrate deploy  # Run migrations (prod)
npx prisma studio          # Database GUI

# Deployment
vercel deploy              # Deploy to preview
vercel deploy --prod       # Deploy to production
vercel logs --follow       # Monitor logs
```

## Environment Variables

See `.env.example` for required variables. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth encryption key
- `ENCRYPTION_KEY`: AES-256-GCM key for tokens
- Twitter API credentials (OAuth 1.0a and 2.0)

## Testing

Before pushing changes:
- Test OAuth flows manually
- Verify webhook registration works
- Check tweet publishing endpoint
- Test multi-project isolation

## Common Pitfalls

1. **Don't skip the build step** - Deployments will fail
2. **Don't use Prisma 7** - Has engine type issues
3. **Don't forget to generate Prisma Client** after schema changes
4. **Don't commit without type checking** - Prevents build errors
5. **Don't use `|| null` with Array.find()** - Returns undefined

## Deployment Verification

After pushing to GitHub:

1. Check Vercel deployment status
2. Review build logs for errors
3. Test the deployed application:
   - Admin login works
   - Project creation works
   - Bot connection works
   - Webhook forwarding works
4. Monitor runtime logs for errors

## Getting Help

- Check deployment logs: `vercel logs hive.pepes.dog --production`
- Review README.md for setup instructions
- Check Prisma docs for ORM questions
- Review Next.js docs for framework questions
