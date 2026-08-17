# Variables and secrets

| Name | Used by | Scope | Source | Rotation | Risk |
| --- | --- | --- | --- | --- | --- |
| `PORT` | local start script | server process | environment, optional | not applicable | Port collision only |
| DeepSeek/API provider Key | official Harness provider settings | local Harness runtime / provider | user input | rotate in provider console and replace locally | High; never commit or log |
| `.runtime/dsh-home` | project-private Harness profile | local filesystem | generated at start | delete and regenerate | May contain local configuration |

The competition plugin bundles no secret and exposes no client-side secret constant. `.runtime/` is ignored and must not be included in archives or commits.

## Pre-submission / pre-go-live

- Run repository secret scan and inspect staged diff.
- Confirm public Demo contains synthetic data only.
- Confirm `.runtime/`, local uploads and credentials are absent.
- For remote deployment, move provider credentials to a server-side secret store and add authenticated per-user storage.
