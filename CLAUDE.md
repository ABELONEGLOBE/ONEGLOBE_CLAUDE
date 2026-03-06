# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface; Claude generates code using tool calls to a virtual file system, which is rendered in real-time in a preview frame.

## Tech Stack

- **Next.js 15** (App Router, Server Components, Server Actions)
- **React 19** + TypeScript
- **Tailwind CSS v4** + Shadcn/ui (new-york style, Lucide icons)
- **Vercel AI SDK** (`ai` package) with `@ai-sdk/anthropic` for Claude streaming
- **Prisma** ORM with **SQLite** database
- **JWT** sessions via `jose`, passwords via `bcrypt`
- **Vitest** + React Testing Library for tests
- **Monaco Editor** for code editing, **Babel standalone** for JSX transformation

## Commands

```bash
npm run setup       # Install deps + generate Prisma client + run migrations
npm run dev         # Dev server at localhost:3000 (Turbopack)
npm run dev:daemon  # Dev server in background (logs to logs.txt)
npm run build       # Production build
npm run start       # Production server
npm test            # Run Vitest unit tests
npm run lint        # ESLint
npm run db:reset    # Drop and re-run all migrations
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

Test file conventions:
- Place test files in a `__tests__/` directory next to the source file
- Name them `[filename].test.ts` or `[filename].test.tsx`
- Use `@/` path alias for all imports
- Add `// @vitest-environment node` at the top for files using `jose` or other Node-only APIs

## Custom Slash Commands

Defined in [.claude/commands/](.claude/commands/):

- `/write_tests <file>` — Generate Vitest + React Testing Library tests for a source file
- `/audit` — Run `npm audit`, apply fixes, and verify tests still pass

## Architecture

### Three-Panel Layout
[src/app/main-content.tsx](src/app/main-content.tsx) renders resizable panels: Chat (left) | Code Editor (middle) | Preview (right). State is managed via two React Contexts:
- [src/lib/contexts/chat-context.tsx](src/lib/contexts/chat-context.tsx) — chat messages, AI streaming, tool call results
- [src/lib/contexts/file-system-context.tsx](src/lib/contexts/file-system-context.tsx) — virtual file system state

### Virtual File System
[src/lib/file-system.ts](src/lib/file-system.ts) — `VirtualFileSystem` class stores files in-memory as a tree. It serializes to/from JSON for persistence in the database. Files never touch disk; the preview renders from in-memory state.

### AI Integration
- [src/app/api/chat/route.ts](src/app/api/chat/route.ts) — streaming POST endpoint using Vercel AI SDK `streamText`
- [src/lib/provider.ts](src/lib/provider.ts) — returns `anthropic("claude-haiku-4-5")` or `MockLanguageModel` (if no `ANTHROPIC_API_KEY`)
- [src/lib/tools/str-replace.ts](src/lib/tools/str-replace.ts) — Claude's primary editing tool (`str_replace_editor`)
- [src/lib/tools/file-manager.ts](src/lib/tools/file-manager.ts) — file create/delete tools
- [src/lib/prompts/generation.tsx](src/lib/prompts/generation.tsx) — system prompt for component generation

### Data Persistence
The database schema is defined in [prisma/schema.prisma](prisma/schema.prisma) — reference it anytime you need to understand the structure of data stored in the database. Models: `User` and `Project`. Projects store `messages` (JSON array) and `data` (VirtualFileSystem JSON) as string columns. Server Actions in [src/actions/](src/actions/) handle all DB operations.

### Authentication
[src/lib/auth.ts](src/lib/auth.ts) — JWT session management with HTTP-only cookies. [src/middleware.ts](src/middleware.ts) enforces auth on protected routes. Anonymous mode is supported (`userId` is optional on `Project`).

## Code Conventions

- Use comments sparingly; only comment complex code.

## Environment

`.env` file required with optional `ANTHROPIC_API_KEY`. Without it, [src/lib/provider.ts](src/lib/provider.ts) returns a mock model with static responses.
