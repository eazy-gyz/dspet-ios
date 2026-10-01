#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 dsh-pet 的 mov 素材包（中文文件名）映射成 aNNN.mov，放进 app/Resources/web/assets/。

用法：
    python3 tools/prepare_assets.py <素材包.zip 或 解压后的目录>

映射表直接从 app/Resources/web/pet.js 里的 NAME_MAP 读，保证和网页端一一对应。
之所以不把 80MB 视频直接放进仓库：
  · 仓库小（几 MB），push 快、下载快
  · 素材始终留在它的来源项目里，许可关系更清楚
CI（.github/workflows/build-ipa.yml）会在编译前自动调用本脚本。
"""
import os
import re
import sys
import shutil
import zipfile
import pathlib

# Windows 控制台默认 GBK，直接 print emoji 会炸；统一按 UTF-8 输出
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "app" / "Resources" / "web"
ASSETS = WEB / "assets"
PET_JS = WEB / "pet.js"


def load_name_map():
    src = PET_JS.read_text(encoding="utf-8")
    m = re.search(r"var NAME_MAP\s*=\s*\{(.*?)\};", src, re.S)
    if not m:
        sys.exit("在 pet.js 里找不到 NAME_MAP")
    return dict(re.findall(r"'([^']+)'\s*:\s*'([^']+)'", m.group(1)))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    nm = load_name_map()
    print(f"NAME_MAP: {len(nm)} 条")
    ASSETS.mkdir(parents=True, exist_ok=True)

    done = 0
    if src.lower().endswith(".zip"):
        with zipfile.ZipFile(src) as z:
            for entry in z.infolist():
                if not entry.filename.lower().endswith(".mov"):
                    continue
                cn = os.path.splitext(os.path.basename(entry.filename))[0]
                if cn in nm:
                    with z.open(entry) as fin, open(ASSETS / (nm[cn] + ".mov"), "wb") as fout:
                        shutil.copyfileobj(fin, fout)
                    done += 1
    else:
        for p in pathlib.Path(src).glob("*.mov"):
            if p.stem in nm:
                shutil.copy2(p, ASSETS / (nm[p.stem] + ".mov"))
                done += 1

    print(f"已生成 {done} 个 .mov -> {ASSETS}")

    missing = [k for k, v in nm.items() if not (ASSETS / (v + ".mov")).exists()]
    if missing:
        print("[缺少] ", "、".join(missing))
        sys.exit(1)
    total = sum(p.stat().st_size for p in ASSETS.glob("*.mov"))
    print(f"[OK] 全部齐了，合计 {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
