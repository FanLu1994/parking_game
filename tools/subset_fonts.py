"""字体本地子集化（设计案 §5）：只保留游戏用到的字，输出 woff2。

用法：
  pip install fonttools brotli
  把源字体放到 fonts/src/：ZCOOLKuaiLe-Regular.ttf、NotoSansSC-Regular.ttf（均为 OFL 授权）
  python tools/subset_fonts.py
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = [
    ("ZCOOLKuaiLe-Regular.ttf", "zcool-kuaile-subset.woff2"),
    ("NotoSansSC-Regular.ttf", "noto-sans-sc-subset.woff2"),
]


def collect_text() -> str:
    chars = set()
    for p in [ROOT / "index.html", *sorted((ROOT / "js").glob("*.js"))]:
        chars.update(p.read_text(encoding="utf-8"))
    chars.update(chr(c) for c in range(0x20, 0x7F))  # ASCII 全保留
    return "".join(sorted(c for c in chars if c.isprintable()))


def main() -> int:
    text = collect_text()
    out_dir = ROOT / "fonts"
    (out_dir / "chars.txt").write_text(text, encoding="utf-8")
    total = 0
    for src, dst in FONTS:
        src_path = out_dir / "src" / src
        if not src_path.exists():
            print(f"缺少源字体：{src_path}")
            return 1
        subprocess.run([
            sys.executable, "-m", "fontTools.subset", str(src_path),
            f"--text-file={out_dir / 'chars.txt'}",
            "--flavor=woff2", "--layout-features=*",
            f"--output-file={out_dir / dst}",
        ], check=True)
        size = (out_dir / dst).stat().st_size
        total += size
        print(f"{dst}: {size / 1024:.1f} KB")
    print(f"合计 {total / 1024:.1f} KB（目标 < 200 KB），{len(text)} 个字符")
    return 0


if __name__ == "__main__":
    sys.exit(main())
