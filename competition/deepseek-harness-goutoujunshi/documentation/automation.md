# Embedded Agent and automation boundary

## Doghead strategist Agent

- Trigger: user sends a message in temporary or object conversation.
- Owner: local user.
- Execution: responds on demand; never runs in the background.
- Inputs: current message, current object-scoped refined context, and at most 1–3 routed read-only Skill references.
- Tools: `goutoujunshi_route_references`, `goutoujunshi_identity_and_evidence`, `goutoujunshi_memory`.
- Steering: plugin system prompt describes emotional acknowledgement, fact/inference/unknown separation, actionable wording, observation window and stop conditions.
- Hard guardrails: object ID scoping, reference whitelist, identity-conflict stop, read-only protected files, no automatic sending.
- Output: conversational advice plus optional user-confirmed action/task. Tool failures return bounded errors and do not authorize broader reads.

## App-owned versus Agent-owned

The Agent may suggest an action, wording, observation window or stop condition. The application owns object isolation, identity mapping, evidence references, memory operations and the confirmation gate. Neither layer can send a message to the relationship object in this version.

## Controls

- Approval: user must confirm adoption of a proposed step.
- Audit/undo: object operations retain a reversible local history.
- Kill switch: use temporary mode, pause memory, remove provider configuration, archive/delete an object, or stop the local server.
- Rate limits/retries: delegated to the configured Harness model provider; the competition plugin adds no background retry loop.
