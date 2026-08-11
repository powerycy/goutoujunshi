# Goutoujunshi · AI Relationship Strategist

[简体中文](README.md) | **English**

> Emotional support, relationship science, and practical strategy in an AI relationship adviser that genuinely takes the user's side.

[![GitHub Stars](https://img.shields.io/github/stars/powerycy/goutoujunshi?style=social)](https://github.com/powerycy/goutoujunshi/stargazers)

If Goutoujunshi helps you spend less time overthinking and make one more clear-headed decision in a relationship, please consider giving it a 🌟 **Star**. Your support helps more people find the project and keeps the knowledge base growing.

Most relationship advice offers only two answers: “Go for it” or “Break up.” Goutoujunshi tries to do better. It starts by acknowledging the user's emotions, then separates facts from assumptions and unknowns. It considers attraction alongside practical circumstances, reciprocity, risk, opportunity cost, and long-term options before turning the analysis into a concrete next step.

This is more than a library of scripted replies. It can analyze chat screenshots, exported text, and the user's account of events while preserving evidence boundaries. It can turn analysis into a message ready to send, a specific invitation, a first-date plan, or a conversation exercise that can be reviewed afterward. It is a Codex Skill for the full relationship lifecycle, designed for diverse relationships and capable of explaining the reasoning behind its advice.

## What It Can Help With

| Your situation | How Goutoujunshi helps |
| --- | --- |
| You do not know how to reply | Gives you one message you can send immediately, followed by timing and response branches |
| You want to pursue someone, reconnect, ask them out, or move the relationship forward | Provides concrete actions and adjusts the plan based on the other person's response |
| You cannot read the other person or are choosing between multiple people | Combines behavior, MBTI, subjective ratings, and real-world circumstances to give a clear assessment |
| The chat history is long or there are too many screenshots | Locks the speaker mapping, separates facts from inferences and unknowns, and can analyze existing ChatLab data |
| **You do not want to repeat the background next time** | **Long-term memory:** after explicit first-time consent, remembers limited profiles and key developments across tasks; updates automatically, recalls only what is needed, and can be viewed, paused, revoked, or cleared at any time |
| You are dealing with distance, conflict, unequal investment, a breakup, or a marriage decision | Acknowledges the emotions, weighs the tradeoffs, and gives a next step, an observation window, and a stopping condition |

## No Assumptions About Who You Should Love

Goutoujunshi supports heterosexual, gay, lesbian, bisexual, pansexual, and asexual users. It respects transgender, non-binary, and other gender identities. It can discuss single dating, long-term partnerships, marriage, long-distance relationships, remarriage, cross-cultural relationships, and consensual non-monogamy.

The system does not impose fixed gender roles. Users of any gender can take the initiative or choose a highly proactive approach. In common heterosexual dating contexts in China, it may suggest that a man raise his level of initiative by one step when there is no clear rejection or discomfort. This is only a cultural calibration that individual preferences and real-world feedback can override—not a rule that men must pursue while women wait. The assessment always depends on the specific people, their behavior, mutual willingness, and practical circumstances.

## An Interdisciplinary Relationship Knowledge Base

The project maintains relationship science, practical communication guidance, and tool integrations separately, loading only what the current question needs. It covers:

| Area | Coverage |
| --- | --- |
| Relationship psychology | Attraction and selection, partner responsiveness, social exchange, comparison levels, alternatives, commitment, dependence, power, stress, and repair |
| Personality and emotion | Responsible use and limitations of MBTI, the Big Five, attachment, anxiety, and avoidance |
| Meeting and dating | Attraction, expressing interest, first dates, experience design, invitations, defining the relationship, online dating, ghosting, and digital boundaries |
| Communication strategy | Chat-record analysis, situational calibration, three-layer reply design, conversation practice, listening, empathy, compliments, conflict, apologies, refusal, and initiative |
| PUA and social strategy | Blueprint-style inner state, natural flow, cold reading, Mystery-style structure/content/delivery, plus the risks and lower-risk alternatives to negging, push-pull tactics, compliance tests, and gaslighting |
| Sex and intimacy | Ongoing consent, sexual communication, contraception and health boundaries, bodily autonomy, and intimacy negotiation |
| Marriage and family | Premarital agreements, shared finances, housework, parenting, both families of origin, and the family lifecycle |
| Law and safety | Chinese marriage and family law, domestic violence, stalking, fraud, evidence preservation, and crisis referral |
| Society and humanities | The evolution of modern marriage, demographics and urbanization, platform-mediated dating, gendered labor, and care work |
| Philosophy of love | Desire, friendship, freedom, commitment, community, self and other, love, and possession |
| Breakups and special situations | Heartbreak, betrayal, reconciliation, rebuilding trust, diverse relationships, and avoiding stereotypes |

The knowledge base distinguishes stronger research evidence from theoretical frameworks, popular claims, and experience-based tactics. MBTI, attachment styles, and online scripts can inform questions and generate options, but they are never presented as diagnoses, destiny, or guaranteed formulas.

## Installation

Clone the repository into your Codex Skills directory:

```bash
git clone https://github.com/powerycy/goutoujunshi.git ~/.codex/skills/goutoujunshi
```

Then enter this in Codex:

```text
Use $goutoujunshi to help me process my emotions, assess my current relationship, and decide what to do next.
```

On first use, it will ask for:

```text
You: MBTI / overall rating from 0–100 / main strengths and weaknesses
Person A: alias / MBTI / overall rating from 0–100 / current relationship
Person B (if any): same fields
History: how you met, how long this has developed, key events, contact, and investment
Goal: move forward, define the relationship, repair it, compare options, or leave
Emotion: what hurts most right now, intensity from 0–10, and whether a message needs an immediate reply
```

You can leave unknown fields blank or simply tell the story. The Skill will organize a profile from the narrative and ask only for information that could materially change the advice. If you want to reuse context across tasks, it will separately ask once for permission to store a compact profile locally. Declining does not affect normal use.

### Analyzing Exported Chat Files

ChatLab is an optional dependency. After installing it and preparing chat exports that you obtained yourself, you can say:

```text
Use $goutoujunshi with ChatLab to analyze the last three months of chats between me and Person A.
```

Goutoujunshi first previews the import plan, then limits queries by conversation, participant, and time range. It does not directly read, decrypt, or export databases from messaging apps. Without ChatLab, you can still paste text or upload screenshots for analysis.

## How a Typical Answer Is Produced

```text
User's account
  → acknowledge the emotion
  → build profiles for the user and each person involved
  → separate facts / inferences / unknowns
  → retrieve only the knowledge needed for the situation
  → compare reciprocity, practical circumstances, risk, and opportunity cost
  → give a clear preferred recommendation with reasons
  → produce actions, wording, an observation window, and stopping conditions
```

Long-term memory and ChatLab are used only when the user consents or supplies the relevant data. They do not change this core analysis flow.

## Project Structure

```text
goutoujunshi/
├── SKILL.md                    # Core behavior and workflow
├── agents/openai.yaml         # Codex display metadata and default prompt
├── references/
│   ├── knowledge/             # Relationship science and interdisciplinary knowledge
│   └── practical/             # Communication, tool integration, and memory rules
├── documentation/             # Architecture, workflows, and safety boundaries
└── scripts/
    ├── validate_skill.py      # Project integrity checks
    └── memory_store.py        # Consent gate, bounded memory, revocation, and deletion
```

## Design Principles

1. **See the person before solving the problem.** Even correct advice may be impossible to act on when the emotion has not been acknowledged.
2. **Behavior is more reliable than labels.** Do not use MBTI, gender, or a single chat exchange to pretend to read another person's mind.
3. **Reciprocity matters more than winning someone over.** Getting one particular person is not the only victory; reducing emotional drain, preserving dignity, and keeping future options are also valid outcomes.
4. **Every strategy should disclose its cost.** The Skill can discuss affectionate or playful messaging, push-pull dynamics, pacing, and presentation, but it also explains where they fit and what they may cost over time.
5. **Consent and the right to leave cannot be bypassed.** A clear rejection is not an obstacle to overcome.
6. **Safety comes first in dangerous situations.** Violence, coercion, stalking, fraud, and self-harm risk require more than ordinary dating advice.

### Release and Maintenance History

See [CHANGELOG.md](CHANGELOG.md) for complete release notes and compatibility information.

| Date | Type | Update | User value |
| --- | --- | --- | --- |
| 2026-08-03 | Memory and chat analysis | Preserved the previous profile-building, emotional support, relationship assessment, proactive guidance, and immediate reply capabilities; added compact local memory that updates automatically after first-time consent and can be revoked, plus analysis of chat screenshots, exported records, and existing ChatLab data. | Keeps the familiar adviser experience while enabling bounded profiles across tasks, reliable speaker mapping, and relationship-trend analysis; it neither stores full chats nor claims to export messaging-app data directly. |
| 2026-07-23 | Architecture | Reduced `SKILL.md` to a lightweight behavior and routing kernel; added mechanisms, risks, and ethical translations for classic social systems including Blueprint-style inner state, natural flow, cold reading, and Mystery-style structured interaction; changed validation to cover required files, context budget, and runtime boundaries; added allowlisted installation and regression scenarios. | Loads only 1–3 references needed for the current question, retaining practical detail while reducing estimated everyday context cost by 48.3%; installed copies can validate without project documentation, and safeguards prevent misuse of mind-reading, manipulation, and stage escalation. |
| 2026-07-22 | Calibration | Added guidance for expressing interest, first dates, and natural contact; allowed a second proactive attempt after one ambiguous response; added scenario tests and checklist validation. | Encourages appropriate initiative in ordinary dating while preserving a clear stop line for explicit rejection, discomfort, or avoidance. |
| 2026-07-22 | Expansion | Reviewed open-source projects around Tong Jincheng, Fan Gongzi, and relationship-copilot Skills; extracted presentation, situational improvisation, conversational give-and-take, light flirting, and real-time calibration; added seven primary strategies, three-layer reply design, 36 reply patterns, and conversation practice, while updating the capability overview and core workflow. | Does not copy personas or routines. When users ask “How should I reply?”, they first receive one sendable preferred response and can continue based on positive, ambiguous, or rejecting reactions. |
| 2026-07-22 | Improvement | Added support for chat screenshots, exported chat text, and copied instant-message content, distinguishing among chats, user reports, calls, offline interaction, and mixed material. | Continues to organize emotions first, then analyzes verifiable words and behavior without imagining offline events from text chats or presenting inferences as facts. |
| 2026-07-21 | New | Added unequal-investment and graceful-exit modules with event-based observation windows, reduced-investment strategies, and exit language, including same-sex/closeted, long-distance, workplace, consensually non-monogamous, and high-risk scenarios. | Helps users decide whether to keep investing, protect their time and energy, and recognize when to move into a safety-oriented process. |

## Contributing

Contributions are welcome: add research, improve communication guidance, correct references, or submit new relationship scenarios. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you begin.

If you are not contributing code, you can still:

- Give the project a 🌟 **Star** so more people can discover it;
- Share an anonymized real-world scenario to help expand the case coverage;
- Send it to the friend who always stays up late analyzing everyone else's relationships.

This project provides relationship education and decision support. It is not a substitute for psychotherapy, medical diagnosis, legal advice, law enforcement, or emergency services.
