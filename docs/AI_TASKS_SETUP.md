# AI tasks and Gmail drafts

The Tasks page can now analyze the signed-in member's assigned Gmail messages, create deduplicated CRM tasks, and save a personalized response to Gmail Drafts for human review.

## Required APIs and manual setup

### 1. OpenAI Responses API

1. Create an OpenAI API project and API key in the OpenAI Platform.
2. Add billing/credits for that API project.
3. Add these production environment variables:

```env
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5.6-sol
```

4. Redeploy the CRM.

The key must remain server-side. A ChatGPT subscription and ChatGPT's personal Gmail connector do not provide an API key and cannot be reused by this CRM.

The CRM sends only the recent messages assigned to the current member and existing task titles to the model. Responses are requested with `store: false` and constrained with a JSON schema before any task is written.

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
