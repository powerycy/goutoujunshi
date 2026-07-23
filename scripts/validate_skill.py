#!/usr/bin/env python3
"""Validate the distributable goutoujunshi skill without third-party packages."""

from __future__ import annotations

import re
import subprocess
import sys
from math import ceil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
MIN_KNOWLEDGE_DOCUMENTS = 20
MIN_PRACTICAL_DOCUMENTS = 20
SKILL_MAX_LINES = 150
SKILL_MAX_CHARACTERS = 5_000
SKILL_MAX_APPROX_TOKENS = 4_500

REQUIRED_KNOWLEDGE = (
    "01-证据分级与内容边界.md",
    "05-PUA操控与伦理替代.md",
    "08-同意边界性与亲密.md",
    "09-在线约会与数字关系.md",
    "17-中国法律安全与危机转介.md",
    "20-经典社交体系的机制、证据与风险边界.md",
)

REQUIRED_PRACTICAL = (
    "00-导读与使用分级.md",
    "关系投入失衡：互惠判断、降级投入与退出决策.md",
    "场景感、松弛感与社交校准：从接话到关系推进.md",
    "实战话术编排器：从一句回复到后续分支.md",
    "主动表达、第一次见面与自然接触.md",
    "自然流、内在状态与结构化互动：伦理能力转译.md",
)

REQUIRED_SCENARIOS = (
    "chat-record-analysis-scenarios.md",
    "relationship-investment-scenarios.md",
    "social-calibration-scenarios.md",
    "tactical-reply-scenarios.md",
    "active-dating-scenarios.md",
    "classic-social-framework-scenarios.md",
)


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


def approximate_token_count(content: str) -> int:
    """Return a conservative, dependency-free budget estimate for mixed Chinese text."""
    cjk = len(re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]", content))
    latin_words = len(re.findall(r"[A-Za-z0-9_]+", content))
    other = len(re.findall(r"[^\sA-Za-z0-9_\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]", content))
    return cjk + ceil(latin_words * 1.3) + ceil(other / 4)


def validate_skill_budget() -> None:
    skill = ROOT / "SKILL.md"
    if not skill.is_file():
        return

    content = skill.read_text(encoding="utf-8")
    lines = len(content.splitlines())
    characters = len(content)
    approx_tokens = approximate_token_count(content)
    if lines > SKILL_MAX_LINES:
        ERRORS.append(f"SKILL.md exceeds {SKILL_MAX_LINES} lines: {lines}")
    if characters > SKILL_MAX_CHARACTERS:
        ERRORS.append(
            f"SKILL.md exceeds {SKILL_MAX_CHARACTERS} characters: {characters}"
        )
    if approx_tokens > SKILL_MAX_APPROX_TOKENS:
        ERRORS.append(
            "SKILL.md exceeds approximate token budget "
            f"{SKILL_MAX_APPROX_TOKENS}: {approx_tokens}"
        )


def validate_inventory(runtime_only: bool) -> None:
    require("agents/openai.yaml")
    if not runtime_only:
        require("README.md")
        require("LICENSE")
    knowledge = list((ROOT / "references/knowledge").glob("*.md"))
    practical = list((ROOT / "references/practical").glob("*.md"))
    if len(knowledge) < MIN_KNOWLEDGE_DOCUMENTS:
        ERRORS.append(
            "expected at least "
            f"{MIN_KNOWLEDGE_DOCUMENTS} knowledge documents, found {len(knowledge)}"
        )
    if len(practical) < MIN_PRACTICAL_DOCUMENTS:
        ERRORS.append(
            "expected at least "
            f"{MIN_PRACTICAL_DOCUMENTS} practical documents, found {len(practical)}"
        )
    for filename in REQUIRED_KNOWLEDGE:
        require(f"references/knowledge/{filename}")
    for filename in REQUIRED_PRACTICAL:
        require(f"references/practical/{filename}")
    if not runtime_only:
        for filename in REQUIRED_SCENARIOS:
            require(f"tests/{filename}")

    agent = ROOT / "agents/openai.yaml"
    if agent.is_file() and "$goutoujunshi" not in agent.read_text(encoding="utf-8"):
        ERRORS.append("agents/openai.yaml default prompt must mention $goutoujunshi")


def validate_routes_and_regressions(runtime_only: bool) -> None:
    skill = ROOT / "SKILL.md"
    if skill.is_file():
        content = skill.read_text(encoding="utf-8")
        required_routes = (
            "references/knowledge/20-经典社交体系的机制、证据与风险边界.md",
            "references/practical/自然流、内在状态与结构化互动：伦理能力转译.md",
            "默认只读取当前问题直接需要的 1–3 份参考",
        )
        for route in required_routes:
            if route not in content:
                ERRORS.append(f"SKILL.md missing required progressive-disclosure route: {route}")

    scenarios = ROOT / "tests/classic-social-framework-scenarios.md"
    if runtime_only:
        return
    if scenarios.is_file():
        content = scenarios.read_text(encoding="utf-8")
        coverage_markers = (
            "冷读",
            "自然流",
            "结构化互动",
            "聊天截图",
            "按需加载",
            "明确拒绝",
            "煤气灯",
            "隔离",
        )
        for marker in coverage_markers:
            if marker not in content:
                ERRORS.append(
                    "classic social framework regression scenarios missing coverage: "
                    f"{marker}"
                )


def validate_runtime_boundaries() -> None:
    if (ROOT / ".git").exists():
        tracked_research = subprocess.run(
            ["git", "ls-files", "--", "research", "恋爱知识库"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        ).stdout.splitlines()
        for path in tracked_research:
            ERRORS.append(
                f"raw research must remain untracked and outside runtime content: {path}"
            )

    runtime_roots = (
        ROOT / "SKILL.md",
        ROOT / "agents",
        ROOT / "references",
        ROOT / "scripts",
        ROOT / "assets",
    )
    forbidden_parts = {"research", "documentation", "tests", ".git", "__pycache__"}
    for runtime_root in runtime_roots:
        if not runtime_root.exists():
            continue
        paths = (runtime_root,) if runtime_root.is_file() else runtime_root.rglob("*")
        for path in paths:
            if forbidden_parts.intersection(path.relative_to(ROOT).parts):
                ERRORS.append(
                    "non-runtime content nested inside runtime allowlist: "
                    f"{path.relative_to(ROOT)}"
                )
            if path.is_file() and path.suffix in {".pyc", ".pyo"}:
                ERRORS.append(
                    f"compiled test/runtime artifact found: {path.relative_to(ROOT)}"
                )


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
    unexpected_args = [arg for arg in sys.argv[1:] if arg != "--runtime"]
    if unexpected_args:
        print(f"ERROR: unsupported arguments: {' '.join(unexpected_args)}")
        return 2
    runtime_only = "--runtime" in sys.argv[1:]

    validate_frontmatter()
    validate_skill_budget()
    validate_inventory(runtime_only)
    validate_routes_and_regressions(runtime_only)
    validate_runtime_boundaries()
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
