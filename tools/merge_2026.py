#!/usr/bin/env python3
"""把 data/topics_2026.json（2026考研数三，2025年12月初试）合并进 topics.json 与 meta.json。

校验：18章键齐全、总分=150（±2 内允许并在 notes 说明）、year=2026 且 topics.json 中无重复。
用法：python3 tools/merge_2026.py
"""
import json
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parents[1] / "data"

TAXONOMY = [
    "函数、极限、连续", "一元函数微分学", "一元函数积分学", "多元函数微积分学",
    "无穷级数", "常微分方程与差分方程", "行列式与矩阵", "向量组", "线性方程组",
    "特征值与特征向量", "二次型", "随机事件与概率", "随机变量及其分布",
    "多维随机变量及其分布", "随机变量的数字特征", "大数定律与中心极限定理",
    "数理统计的基本概念", "参数估计",
]


def main():
    y26 = json.loads((BASE / "topics_2026.json").read_text(encoding="utf-8"))
    meta26 = json.loads((BASE / "meta_2026.json").read_text(encoding="utf-8"))
    topics = json.loads((BASE / "topics.json").read_text(encoding="utf-8"))
    meta = json.loads((BASE / "meta.json").read_text(encoding="utf-8"))

    if y26.get("year") != 2026:
        sys.exit("FATAL: year != 2026")
    if any(t["year"] == 2026 for t in topics):
        print("SKIP: topics.json 已含 2026，如需重跑请先手动移除")
        return

    chapters = y26["chapters"]
    missing = [c for c in TAXONOMY if c not in chapters]
    extra = [k for k in chapters if k not in TAXONOMY]
    if missing or extra:
        sys.exit(f"FATAL: 章节键不匹配 missing={missing} extra={extra}")

    total = sum(v for v in chapters.values() if isinstance(v, (int, float)))
    if abs(total - 150) > 2:
        ans = input(f"总分 {total} 偏离 150 超过 2 分（notes: {y26.get('notes')}），仍要合入？[y/N] ")
        if ans.strip().lower() != "y":
            sys.exit("已中止")

    topics.append(y26)
    topics.sort(key=lambda t: t["year"])
    (BASE / "topics.json").write_text(
        json.dumps(topics, ensure_ascii=False, indent=2), encoding="utf-8")

    for s in meta26.get("new_sources", []):
        if s not in meta.get("sources", []):
            meta.setdefault("sources", []).append(s)
    add = meta26.get("caveat_addendum")
    if add:
        cur = meta.get("caveats")
        if isinstance(cur, list):
            meta["caveats"] = cur + [add]
        elif isinstance(cur, str) and cur:
            meta["caveats"] = cur + "\n" + add
        else:
            meta["caveats"] = [add] if not cur else [str(cur), add]
    meta["updated"] = "2026-10-27"
    (BASE / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK: 已合入 2026（{len(chapters)} 章，总分 {total}）；topics 共 {len(topics)} 卷")


if __name__ == "__main__":
    main()
