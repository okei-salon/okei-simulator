#!/usr/bin/env python3
"""Validate OUKEI HUB kai2-unified .hub before production restore."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

OLD = "m1783174063025"
NEW = "imp_mr604mrj_0"


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def has_ram_revenue(ae: dict | None) -> bool:
    return bool(ae and ae.get("todayRevenue") not in (None, ""))


def has_ram_sales(ae: dict | None) -> bool:
    return bool(ae and ae.get("todaySales") is not None)


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "merge-output/OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub")
    data = load(path)
    settings = data.get("settings") or {}
    members = data.get("members") or []
    issues: list[str] = []
    warnings: list[str] = []

    blob = json.dumps(data, ensure_ascii=False)
    if OLD in blob:
        issues.append(f"OLD ID still present ({blob.count(OLD)} occurrences)")

    if len(members) != 39:
        issues.append(f"members count {len(members)} != 39")
    if len(data.get("currentData") or []) != 39:
        issues.append(f"currentData count {len(data.get('currentData') or [])} != 39")
    if len(data.get("rootAccountIds") or []) != 8:
        issues.append(f"rootAccountIds count {len(data.get('rootAccountIds') or [])} != 8")

    orca_chart = data.get("orcaOrgChart") or {}
    orca_members = orca_chart.get("members") or []
    orca_roots = orca_chart.get("rootAccountIds") or []
    orca_accounts = settings.get("orcaInputAccounts") or []
    orca_with_parent = sum(
        1 for m in orca_members if isinstance(m, dict) and m.get("parent")
    )
    if len(orca_accounts) < 1:
        issues.append("orcaInputAccounts missing")
    if len(orca_members) < len(orca_accounts):
        issues.append(
            f"orcaOrgChart members {len(orca_members)} < orcaInputAccounts {len(orca_accounts)}"
        )
    if len(orca_roots) < len(orca_accounts):
        issues.append(
            f"orcaOrgChart rootAccountIds {len(orca_roots)} < orcaInputAccounts {len(orca_accounts)}"
        )
    if not orca_chart.get("rootId"):
        issues.append("orcaOrgChart rootId empty")
    if orca_with_parent < 1:
        warnings.append(
            "orcaOrgChart has no parent/child links (kai1/kai2 only). "
            "Embed merge-input/ORCA_ORG_SNAPSHOT.json before production restore."
        )

    if len(settings.get("revenueLog") or {}) != 223:
        issues.append("revenueLog count != 223")
    if len(settings.get("salesLog") or {}) != 153:
        issues.append("salesLog count != 153")

    id_counts = Counter(m.get("id") for m in members if isinstance(m, dict))
    duplicate_ids = [mid for mid, count in id_counts.items() if count > 1]
    if duplicate_ids:
        issues.append(f"duplicate member ids: {duplicate_ids}")

    if id_counts.get(NEW, 0) != 1:
        issues.append(f"kai2 new id count {id_counts.get(NEW, 0)} != 1")

    member_ids = set(id_counts.keys())
    for m in members:
        parent = m.get("parent")
        if parent and parent not in member_ids:
            issues.append(f"broken parent ref: {m.get('id')} -> {parent}")

    if any(m.get("_kai2MergedSlot") for m in members):
        issues.append("ghost _kai2MergedSlot still present")

    rev_days: set[str] = set()
    sales_days: set[str] = set()
    for dk, entry in (settings.get("revenueLog") or {}).items():
        ra = (entry or {}).get("ramAccounts") or {}
        if OLD in ra:
            issues.append(f"OLD in revenueLog {dk}")
        if NEW in ra and has_ram_revenue(ra[NEW]):
            rev_days.add(dk)
        if OLD in ra and NEW in ra:
            issues.append(f"double kai2 revenue keys on {dk}")
    for dk, entry in (settings.get("salesLog") or {}).items():
        acc = (entry or {}).get("accounts") or {}
        if OLD in acc:
            issues.append(f"OLD in salesLog {dk}")
        ae = acc.get(NEW)
        if ae and has_ram_sales(ae):
            sales_days.add(dk)
        if OLD in acc and NEW in acc:
            issues.append(f"double kai2 sales keys on {dk}")

    if len(rev_days) != 133:
        issues.append(f"kai2 revenue days {len(rev_days)} != 133")
    if len(sales_days) != 127:
        issues.append(f"kai2 sales days {len(sales_days)} != 127")

    roots = data.get("rootAccountIds") or []
    root_users = []
    for rid in roots:
        m = next((x for x in members if x.get("id") == rid), None)
        if not m:
            issues.append(f"root id missing member: {rid}")
        else:
            root_users.append((m.get("username") or "").lower())
    for i in range(3, 9):
        if f"kai{i}" not in root_users:
            issues.append(f"missing root kai{i}")

    print(f"FILE: {path.resolve()}")
    print(f"ISSUES: {len(issues)}")
    for item in issues:
        print(f"  [FAIL] {item}")
    print(f"WARNINGS: {len(warnings)}")
    for item in warnings:
        print(f"  [WARN] {item}")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
