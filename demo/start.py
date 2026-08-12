#!/usr/bin/env python3
"""一键启动脚本：检查依赖 → 启动后端 → 自动打开浏览器。

直接双击（Windows 上需要先关联 .py 到 Python），或运行：

    python start.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# Windows 默认 GBK，会让中文 / emoji 输出崩。强制 UTF-8。
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = Path(__file__).resolve().parent
REQ  = ROOT / "requirements.txt"

REQUIRED = {
    "fastapi":     "fastapi",
    "uvicorn":     "uvicorn",
    "pandas":      "pandas",
    "numpy":       "numpy",
    "yaml":        "pyyaml",
    "click":       "click",
}

OPTIONAL_PROVIDERS = (
    ("anthropic", "走 Anthropic Claude"),
    ("openai",    "走 OpenAI / DeepSeek / Gemini / 国产八家（OpenAI 兼容协议）"),
)


def check_python():
    if sys.version_info < (3, 8):
        print("[X] 需要 Python 3.8+，你当前是", sys.version.split()[0])
        sys.exit(1)
    print(f"[OK] Python {sys.version.split()[0]}")


def pip_install(pkgs):
    print(f"  正在安装：{' '.join(pkgs)} …")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--quiet", *pkgs]
    )


def check_required():
    missing = []
    for mod, pkg in REQUIRED.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"[!] 缺少必需依赖：{', '.join(missing)}")
        ans = input("  现在自动安装？[Y/n] ").strip().lower()
        if ans in ("", "y", "yes"):
            pip_install(missing)
        else:
            print("已取消。可以手动跑：pip install -r requirements.txt")
            sys.exit(1)
    print("[OK] 必需依赖齐全")


def check_optional():
    have = []
    for mod, desc in OPTIONAL_PROVIDERS:
        try:
            __import__(mod)
            have.append(f"  [OK] {mod} —— {desc}")
        except ImportError:
            have.append(f"  · {mod}  —— {desc}（未安装，需要时再装）")
    print("可选 LLM SDK：")
    for line in have:
        print(line)


def open_browser(url, delay=1.5):
    def _open():
        time.sleep(delay)
        webbrowser.open(url)
    import threading
    threading.Thread(target=_open, daemon=True).start()


def main():
    print("─" * 56)
    print("  关系 K 线 · Relationship Candlestick — 一键启动")
    print("─" * 56)
    check_python()
    check_required()
    check_optional()

    host = "127.0.0.1"
    port = int(os.environ.get("RCL_PORT", "7000"))
    url  = f"http://{host}:{port}"

    print()
    print(f"启动 Web 服务：{url}")
    print("（浏览器会在 1-2 秒后自动打开；如果没打开，手动复制上面的链接到浏览器）")
    print("按 Ctrl+C 停止。")
    print("─" * 56)

    open_browser(url)

    # 直接调用包内 server.serve()，避免 subprocess + 信号处理问题。
    sys.path.insert(0, str(ROOT))
    from relationship_candlestick.server import serve

    try:
        serve(host=host, port=port)
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
