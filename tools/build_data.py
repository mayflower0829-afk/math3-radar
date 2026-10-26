#!/usr/bin/env python3
"""把两个项目 data/ 目录下的真实 JSON 转换为 public/data.js。

用法：python3 tools/build_data.py
会在对应 JSON 缺失时跳过该项目并给出提示（保留原有 data.js 不动）。
"""
import json
import pathlib
import re
import sys

WS = pathlib.Path(__file__).resolve().parent.parent


def dump_js(path: pathlib.Path, obj, var: str) -> None:
    path.write_text(
        "/* 由 tools/build_data.py 自动生成，请勿手改；数据来源见页面「数据说明」 */\n"
        f"window.{var} = {json.dumps(obj, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"OK  {path.relative_to(WS)}")


def read_json(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8"))


def build_math3() -> None:
    base = WS / "math3-radar" / "data"
    topics_f, meta_f = base / "topics.json", base / "meta.json"
    if not (topics_f.exists() and meta_f.exists()):
        print("SKIP math3-radar：data/topics.json 或 meta.json 不存在")
        return
    meta = read_json(meta_f)
    years = read_json(topics_f)
    if not isinstance(years, list):
        print("FATAL math3-radar：topics.json 不是数组")
        sys.exit(1)
    # 考纲比例统一解析为数字（如 "约56%（约84分）" -> 56），剔除 totalScore 等非比例键
    raw_ratio = meta.get("syllabusRatio") or {}
    ratio = {}
    for k, v in raw_ratio.items():
        if k == "totalScore":
            continue
        mnum = re.search(r"(\d+(?:\.\d+)?)\s*%", str(v))
        ratio[k] = float(mnum.group(1)) if mnum else None
    out = {
        "meta": {
            "updated": meta.get("updated"),
            "syllabusRatio": ratio,
            "syllabusSource": meta.get("syllabusSource"),
            "sources": meta.get("sources"),
            "caveats": meta.get("caveats"),
        },
        "taxonomy": meta.get("taxonomy"),
        "years": years,
    }
    dump_js(WS / "math3-radar" / "public" / "data.js", out, "MATH3_DATA")


def build_mas() -> None:
    base = WS / "mas-school-guide" / "data"
    schools_f, meta_f = base / "schools.json", base / "meta.json"
    if not (schools_f.exists() and meta_f.exists()):
        print("SKIP mas-school-guide：data/schools.json 或 meta.json 不存在")
        return
    schools = read_json(schools_f)
    meta = read_json(meta_f)
    if not isinstance(schools, list):
        print("FATAL mas-school-guide：schools.json 不是数组")
        sys.exit(1)
    out = {
        "schools": schools,
        "meta": {
            "nationalLine": meta.get("nationalLine"),
            "nationalLineSource": meta.get("nationalLineSource"),
            "updated": meta.get("updated"),
            "caveats": meta.get("caveats"),
        },
    }
    dump_js(WS / "mas-school-guide" / "public" / "data.js", out, "MAS_DATA")


if __name__ == "__main__":
    build_math3()
    build_mas()
