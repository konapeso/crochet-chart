@AGENTS.md

## Workflow

- Never commit directly to `master`. For every task, branch from the latest `master` as `feature/<short-description>`, push it, and open a PR with `gh pr create --base master`.
- `master` deploys to Vercel production; PRs get Vercel preview deployments.
- This is a static export (`output: "export"`). Don't use features that need a server (Route Handlers using Request, Server Actions, cookies, rewrites/redirects/headers, Proxy, ISR, default `next/image` loader). `cacheComponents` / PPR are incompatible with export mode.
- Run `npm run build` and `npm run lint` before opening a PR.
