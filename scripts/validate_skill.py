#!/usr/bin/env python3
"""Validate the distributable goutoujunshi skill without third-party packages."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def require(path: str) -> Path:
    target = ROOT / path
    if not target.exists():
        ERRORS.append(f"missing required path: {path}")
    return target


def validate_frontmatter() -> None:
    skill = require("SKILL.md")
    if not skill.is_file():
        return

    content = skill.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not match:
        ERRORS.append("SKILL.md has invalid YAML frontmatter boundaries")
        return

    frontmatter = match.group(1)
    keys = re.findall(r"^([A-Za-z0-9_-]+):", frontmatter, re.MULTILINE)
    if keys != ["name", "description"]:
        ERRORS.append(f"SKILL.md frontmatter keys must be name, description; got {keys}")

    name_match = re.search(r"^name:\s*([^\n]+)$", frontmatter, re.MULTILINE)
    description_match = re.search(r"^description:\s*(.+)$", frontmatter, re.MULTILINE)
    name = name_match.group(1).strip() if name_match else ""
    description = description_match.group(1).strip() if description_match else ""
    if name != "goutoujunshi" or not re.fullmatch(r"[a-z0-9-]{1,64}", name):
        ERRORS.append(f"invalid skill name: {name!r}")
    if not description or len(description) > 1024 or "<" in description or ">" in description:
        ERRORS.append("description is empty, too long, or contains angle brackets")


def validate_inventory() -> None:
    require("agents/openai.yaml")
    require("README.md")
    require("LICENSE")
    knowledge = list((ROOT / "references/knowledge").glob("*.md"))
    practical = list((ROOT / "references/practical").glob("*.md"))
    if len(knowledge) != 19:
        ERRORS.append(f"expected 19 knowledge documents, found {len(knowledge)}")
    if len(practical) < 19:
        ERRORS.append(f"expected at least 19 practical documents, found {len(practical)}")
    require("references/practical/关系投入失衡：互惠判断、降级投入与退出决策.md")
    require("references/practical/场景感、松弛感与社交校准：从接话到关系推进.md")
    require("references/practical/实战话术编排器：从一句回复到后续分支.md")
    require("references/practical/主动表达、第一次见面与自然接触.md")
    require("tests/chat-record-analysis-scenarios.md")
    require("tests/relationship-investment-scenarios.md")
    require("tests/social-calibration-scenarios.md")
    require("tests/tactical-reply-scenarios.md")
    require("tests/active-dating-scenarios.md")

    agent = ROOT / "agents/openai.yaml"
    if agent.is_file() and "$goutoujunshi" not in agent.read_text(encoding="utf-8"):
        ERRORS.append("agents/openai.yaml default prompt must mention $goutoujunshi")


def validate_markdown_links() -> None:
    link_pattern = re.compile(r"\]\(([^)]+)\)")
    for markdown in ROOT.rglob("*.md"):
        text = markdown.read_text(encoding="utf-8")
        for raw_target in link_pattern.findall(text):
            target = raw_target.strip().split("#", 1)[0]
            if not target or re.match(r"^(?:https?://|mailto:)", target):
                continue
            resolved = (markdown.parent / target).resolve()
            if not resolved.exists():
                ERRORS.append(
                    f"broken local link in {markdown.relative_to(ROOT)}: {raw_target}"
                )


def validate_placeholders() -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        if path.suffix.lower() not in {".md", ".yaml", ".yml", ".py"}:
            continue
        text = path.read_text(encoding="utf-8")
        if "[" + "TODO" in text:
            ERRORS.append(f"template placeholder in {path.relative_to(ROOT)}")


def main() -> int:
    validate_frontmatter()
    validate_inventory()
    validate_markdown_links()
    validate_placeholders()
    if ERRORS:
        for error in ERRORS:
            print(f"ERROR: {error}")
        return 1
    print("goutoujunshi validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
