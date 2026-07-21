# Devpost submission copy

## Project name

Goutou Junshi (狗头军师)

## Tagline

An inclusive relationship copilot that turns emotional uncertainty into one safe, actionable next step.

## Category

Apps for Your Life

## Short description

Goutou Junshi is an evidence-informed Codex skill for dating, relationships, conflict, breakups, and family pressure. It separates facts from guesses, evaluates reciprocity and risk, and produces practical scripts with timing, trade-offs, and stopping rules. It supports LGBTQ+ people, diverse gender identities, consensual non-monogamy, disability, different life stages, and culturally constrained situations without relying on stereotypes.

## Inspiration

The hardest relationship moments rarely arrive as clean questions. They arrive as a flood of screenshots, mixed signals, fear, jealousy, and urgency: “What does this mean?”, “Should I reply?”, or “Am I the only person trying?”

Most relationship advice products answer too quickly. They offer generic comfort, manipulate the other person, or assume every relationship is heterosexual, monogamous, and organized around traditional gender roles. We wanted to build the opposite: a warm but clear-thinking copilot that protects the user’s dignity and choices while treating diverse identities and relationships as normal, first-class cases.

The Chinese internet phrase “狗头军师” describes the trusted friend who helps you strategize through romantic confusion. Our project keeps the humor and emotional closeness of that role, while grounding the advice in observable behavior, consent, reciprocity, safety, and long-term wellbeing.

## What it does

Goutou Junshi guides Codex through a repeatable relationship decision workflow:

1. It first names and regulates the user’s emotion instead of rushing into tactics.
2. It separates known facts, plausible interpretations, and the unknowns that would actually change the decision.
3. It keeps an independent profile for every person involved, preventing details from being mixed across complex situations.
4. It evaluates reciprocity, reliability, boundaries, safety, opportunity cost, and whether an action is reversible.
5. It recommends a next step and, when useful, gives ready-to-send language with timing, expected impact, risks, response branches, and a stopping condition.
6. It recognizes when a situation involves coercion, stalking, abuse, scams, outing risk, or immediate danger and switches from ordinary dating advice to safety-oriented guidance.

The skill uses neutral language by default and never infers a gender role from a name, pronoun, sexual orientation, or relationship structure. Its dedicated diversity module covers LGBTQ+ relationships, coming-out safety, minority stress, transgender and non-binary experiences, consensual non-monogamy, disability, age and power differences, blended families, and cultural or financial constraints.

## How we built it

We built Goutou Junshi as a native Codex skill using progressive disclosure. `SKILL.md` contains the compact orchestration logic, while 30+ focused reference modules provide deeper knowledge only when a case requires it. This makes the system detailed without forcing every conversation to load the whole knowledge base.

Codex and GPT-5.6 were used throughout the project to design the architecture, convert research and practical communication frameworks into routed modules, identify inclusion and safety gaps, revise the workflow, validate metadata, test realistic scenarios, and package the project for installation and judging.

Key human decisions included the user-interest-first objective, the fact/inference/unknown separation, the graded-action format, explicit stopping rules, and the decision to make LGBTQ+ and other diverse relationship experiences first-class product requirements.

## Challenges we ran into

The biggest challenge was balancing empathy with epistemic discipline. A user’s emotion can be completely valid while their interpretation of another person’s behavior remains uncertain. The workflow had to validate the feeling without reinforcing mind-reading.

Another challenge was inclusion without tokenism. Saying “love is love” is not enough when some users face coming-out risk, minority stress, discrimination, unequal legal recognition, or pressure to conform to gender roles. The project therefore separates universal relationship mechanisms—consent, responsiveness, repair—from external pressures that require identity-aware safety reasoning.

Finally, useful advice must be actionable without becoming manipulative. We support humor, pacing, and confident communication, but reject coercion, harassment, forced disclosure, revenge, and attempts to overcome an explicit no.

## Accomplishments that we are proud of

- A complete, installable Codex skill with no external dependencies or API keys.
- A structured path from emotional overwhelm to a concrete next action.
- Independent handling of multiple relationship targets and complex histories.
- First-class LGBTQ+, gender-diverse, consensually non-monogamous, disabled, and culturally constrained scenarios.
- Safety routing for coercion, stalking, abuse, scams, self-harm threats, and outing risk.
- More than 30 progressively loaded knowledge and practical reference modules.
- Ready-to-send communication that includes timing, benefits, risks, response branches, and stopping rules rather than one-shot “magic lines.”

## What we learned

We learned that the most useful AI relationship support is not about predicting another person. It is about increasing the user’s clarity and options. Observable behavior is more reliable than labels; reciprocity matters more than “winning”; and a good recommendation includes the conditions under which the user should stop.

We also learned that inclusive design improves the core product. Asking who did what, what each person consented to, and whether choices are equally available produces better reasoning for every relationship—not only LGBTQ+ relationships.

## What is next

Next we want to add opt-in local relationship timelines, privacy-preserving reflection summaries, multilingual evaluation sets, accessibility-focused interaction modes, and a red-team benchmark for stereotype leakage, coercive advice, accidental outing, and unsafe crisis responses.

## Technology

Codex, GPT-5.6, Markdown, YAML, progressive-disclosure skill architecture

## Required links and placeholders

- Repository: https://github.com/powerycy/goutoujunshi
- Demo video: provided in the Devpost submission form after the final public upload
- Live/test instructions: clone the repository into `~/.codex/skills/goutoujunshi`, restart Codex if needed, and run any prompt from the README
- Codex `/feedback` session ID: provided directly in the Devpost submission form from the primary build task
