# AI tasks and Gmail drafts

The Tasks page can now analyze the signed-in member's assigned Gmail messages, create deduplicated CRM tasks, and save a personalized response to Gmail Drafts for human review.

## Required APIs and manual setup

### 1. AI provider

The default configuration uses Groq's free API tier:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-server-side-key
GROQ_MODEL=openai/gpt-oss-20b
```

Create the key at <https://console.groq.com/keys>, add the variables to the
production environment, and redeploy the CRM. The free-tier task pass analyzes
the latest six untracked assigned emails and truncates long bodies to stay within
the provider's per-minute token allowance.

OpenAI remains an optional paid fallback:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5.6-sol
```

Provider keys must remain server-side.

The selected provider powers the floating Amina assistant inside authenticated CRM and portal shells. Amina stores conversation turns for audit. The chat does not yet receive live CRM or Drive records; current-data questions are routed back to the relevant CRM section instead of being guessed.

The CRM sends only recent messages assigned to the current member and existing task titles to the model. Task output is constrained with a strict JSON schema and validated again with Zod before any task is written.

### 2. Gmail API and OAuth consent

The Google Cloud project must have the **Gmail API** enabled. The CRM now requests:

- `gmail.readonly` to sync incoming messages;
- `gmail.send` for the existing manual send feature;
- `gmail.compose` to save AI replies as drafts.

Because the existing refresh token predates `gmail.compose`, an administrator must open CRM Settings, disconnect/reconnect the shared `ad@italprotein.com` mailbox, and approve the new compose permission after this release is deployed.

For an external Google OAuth app, update the OAuth consent screen and complete any Google verification required for the requested Gmail scopes. For a Google Workspace-only deployment, keep the app restricted to the organization where possible.

## Runtime behavior

- “Generate today's tasks” is an on-demand action and is limited per member.
- It uses the first-mentioned-member Gmail attribution and looks at up to 14 days of assigned mail.
- One active CRM task is created per source email; repeated runs do not duplicate it.
- Email bodies are treated as untrusted content and cannot instruct the model or trigger tools.
- “Draft a reply” creates a Gmail draft only. A member must review and send it manually.
- Task generation and draft creation are server-authorized and audit logged.

If fully automatic daily generation is wanted later, add a protected scheduled route (for example a Vercel Cron calling a `CRON_SECRET`-guarded endpoint) and decide the execution time and which active roles should receive tasks.
