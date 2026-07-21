# Demo video script — target length 2:40

The final video must be public on YouTube, under three minutes, and include audio explaining both the product and how Codex with GPT-5.6 was used.

## 0:00–0:15 — The problem

**Visual:** Title, then fast examples: “What does this message mean?”, “Should I reply?”, “Am I being hidden?”

**Voiceover:**

“Relationship uncertainty is emotional, messy, and high stakes. Most advice answers too fast, guesses what the other person thinks, or assumes every relationship looks the same.”

## 0:15–0:35 — The product

**Visual:** Open Codex with the `goutoujunshi` skill, show the repository structure.

**Voiceover:**

“Goutou Junshi is an inclusive, evidence-informed relationship copilot built as a native Codex skill. It turns an unstructured story into a safe decision process: regulate emotion, separate facts from guesses, evaluate reciprocity and risk, then choose one actionable next step.”

## 0:35–1:30 — Live inclusive scenario

**Visual:** In Codex, enter:

```text
Use $goutoujunshi. I am a woman dating another woman. She is out to friends but not to family, while I feel hidden. Help me talk about visibility without pressuring her to come out.
```

Show the response sections: emotional validation; facts, interpretations, unknowns; recommendation; ready-to-send message; stopping rule.

**Voiceover:**

“Here, the skill does not reduce the problem to whether one partner is proud of the other. It distinguishes a valid need for recognition from external minority stress and coming-out safety. It uses neutral, identity-respecting language and never recommends outing someone. The response identifies the decisive unknowns, then gives a consent-based conversation, the best timing, likely outcomes, risks, and what to do if the answer remains vague.”

## 1:30–1:55 — Architecture

**Visual:** Highlight `SKILL.md`, `references/knowledge/16-多元关系与反刻板印象.md`, and two safety/communication modules.

**Voiceover:**

“The main skill holds a compact orchestration workflow. More than thirty focused modules are loaded only when needed, covering relationship science, conflict repair, consent, online safety, abuse, practical communication, and diverse relationships. This progressive-disclosure architecture keeps the agent efficient while preserving depth.”

## 1:55–2:20 — How Codex and GPT-5.6 were used

**Visual:** Show dated commits and the Codex build task; briefly show validation output.

**Voiceover:**

“Codex with GPT-5.6 was both our building environment and the runtime. We used it to design the architecture, translate research into routed guidance, identify stereotype and safety gaps, revise the skill, validate its structure, forward-test realistic cases, and prepare the judging package. Human decisions defined the voice, product principles, and safety boundaries.”

## 2:20–2:40 — Why it matters

**Visual:** Four cards: clarity, dignity, inclusion, action. End with the project name and repository URL.

**Voiceover:**

“Goutou Junshi does not promise to make someone love you. It helps you protect your dignity, understand the evidence, and keep your choices. Better relationship support is not mind-reading—it is clarity with compassion.”

## Recording checklist

- Record at 1080p with readable text.
- Keep the final cut below 2:55.
- Show the project actually responding inside Codex.
- Keep personal information out of the recording.
- Use only original or properly licensed visuals and music.
- Add English captions if the narration is not in English.
- Upload as Public or Unlisted only if Devpost explicitly accepts Unlisted; the event page currently says publicly visible, so Public is safest.
