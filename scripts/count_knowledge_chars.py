#!/usr/bin/env python3
"""Reproducibly count the repository's Markdown knowledge corpus."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_FILES = sorted((ROOT / "references").rglob("*.md"))
CORE_FILES = [
    ROOT / "SKILL.md",
    *REFERENCE_FILES,
    *sorted((ROOT / "documentation").rglob("*.md")),
]
HAN = re.compile(r"[\u4e00-\u9fff]")


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def count(files: list[Path]) -> tuple[int, int]:
    contents = [text(path) for path in files]
    return sum(map(len, contents)), sum(len(HAN.findall(item)) for item in contents)


def main() -> None:
    reference_chars, reference_han = count(REFERENCE_FILES)
    core_chars, core_han = count(CORE_FILES)
    print("口径：UTF-8 Markdown 解码后的 Unicode 字符（等价于 UTF-8 locale 下 wc -m）")
    print("字符总量包含：中文、英文、数字、标点、空白、Markdown 标记、frontmatter、代码块与重复内容")
    print("严格汉字量仅统计 U+4E00–U+9FFF；英文、数字、标点、空白和 Markdown 标记不计；不去重")
    print(f"references: files={len(REFERENCE_FILES)} unicode_chars={reference_chars} han_chars={reference_han}")
    print(f"core: files={len(CORE_FILES)} unicode_chars={core_chars} han_chars={core_han}")


if __name__ == "__main__":
    main()
