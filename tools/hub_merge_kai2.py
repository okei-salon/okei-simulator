#!/usr/bin/env python3
"""
OUKEI HUB — kai2 ID 統一（読み取り専用 → 新規 .hub 出力）

・入力 .hub をベースに、kai2 旧 ID を新 ID へ統一
・旧 ID キー / 参照を完全削除
・元ファイル・LocalStorage には一切書き込まない
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

KAI2_OLD_ID = "m1783174063025"
KAI2_NEW_ID = "imp_mr604mrj_0"


def load_hub(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_hub(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def norm_username(value: Any) -> str:
    s = str(value or "").replace("@", "").strip()
    return s.lower()


def is_kai2_member(member: dict) -> bool:
    tokens = [norm_username(member.get("username")), norm_username(member.get("name"))]
    return any(t in ("kai2", "甲斐2") for t in tokens if t)


def has_ram_revenue(ae: dict | None) -> bool:
    if not ae:
        return False
    return ae.get("todayRevenue") is not None and ae.get("todayRevenue") != ""


def has_ram_sales(ae: dict | None) -> bool:
    if not ae:
        return False
    if ae.get("todaySales") is not None:
        return True
    return ae.get("totalSales") is not None and ae.get("totalSales") != ""


def round2(n: float) -> float:
    return round(float(n or 0) * 100) / 100


def recalc_revenue_entry(entry: dict) -> dict:
    entry = copy.deepcopy(entry)
    project_keys = ["ram", "orca", "cary", "genesis", "other"]
    for pk in project_keys:
        entry[pk] = 0.0

    for ae in (entry.get("ramAccounts") or {}).values():
        if not has_ram_revenue(ae):
            continue
        op = float(ae.get("operationRevenue") or 0)
        rev = float(ae.get("todayRevenue") or 0)
        entry["ram"] += round2(op + rev)

    for ae in (entry.get("orcaAccounts") or {}).values():
        entry["orca"] += round2(float(ae.get("todayRevenue") or 0))

    for ae in (entry.get("caryAccounts") or {}).values():
        rev = float(ae.get("todayReward") or 0)
        op = float(ae.get("operationRevenue") or 0)
        entry["cary"] += round2(op + rev)

    for pk in project_keys:
        entry[pk] = round2(entry.get(pk) or 0)
    entry["total"] = round2(sum(float(entry.get(pk) or 0) for pk in project_keys))
    return entry


def recalc_sales_entry(entry: dict) -> dict:
    entry = copy.deepcopy(entry)
    project_keys = ["ram", "orca", "cary", "genesis", "other"]
    for pk in project_keys:
        entry[pk] = 0.0

    for ae in (entry.get("accounts") or {}).values():
        pk = ae.get("projectKey") or "other"
        if pk not in project_keys:
            pk = "other"
        entry[pk] += float(ae.get("todaySales") or 0)

    for pk in project_keys:
        entry[pk] = round2(entry.get(pk) or 0)
    entry["total"] = round2(sum(float(entry.get(pk) or 0) for pk in project_keys))
    return entry


def rename_dict_key(
    container: dict,
    old_key: str,
    new_key: str,
    report: dict,
    context: str,
) -> bool:
    """Move old_key → new_key. On collision keep new_key entry, drop old_key."""
    if old_key not in container:
        return False

    value = container.pop(old_key)
    changed = False

    if new_key in container:
        report["collisions"].append(context)
        report["collision_keys_dropped"] += 1
    else:
        container[new_key] = value
        report["keys_renamed"] += 1
        changed = True

    report["keys_removed"] += 1
    return changed


def unify_investment_history(ih: dict | None, report: dict) -> None:
    if not ih or KAI2_OLD_ID not in ih:
        return

    old_block = ih.pop(KAI2_OLD_ID)
    report["investment_history_merged"] = 1

    if KAI2_NEW_ID not in ih:
        ih[KAI2_NEW_ID] = old_block
        report["investment_history_renamed"] = 1
        return

    new_block = ih[KAI2_NEW_ID]
    old_records = (old_block or {}).get("records") or []
    new_records = (new_block or {}).get("records") or []
    merged_records = copy.deepcopy(new_records)

    seen = {
        (r.get("dateKey"), r.get("type"), r.get("amount"))
        for r in merged_records
        if isinstance(r, dict)
    }
    for rec in old_records:
        if not isinstance(rec, dict):
            continue
        sig = (rec.get("dateKey"), rec.get("type"), rec.get("amount"))
        if sig in seen:
            continue
        merged_records.append(copy.deepcopy(rec))
        seen.add(sig)
        report["investment_history_records_appended"] += 1

    new_block["records"] = merged_records
    if not new_block.get("projectKey") and old_block.get("projectKey"):
        new_block["projectKey"] = old_block["projectKey"]


def merge_member_fields(canonical: dict, old: dict) -> list[str]:
    """Fill only missing canonical fields from the old kai2 slot."""
    merged_fields: list[str] = []
    for key, old_val in old.items():
        if key == "id":
            continue
        if key not in canonical or canonical.get(key) in (None, ""):
            canonical[key] = copy.deepcopy(old_val)
            merged_fields.append(key)
    return merged_fields


def remove_duplicate_old_kai2_slots(data: dict, report: dict) -> None:
    """Merge old kai2 slot into canonical entry, then remove duplicate rows."""
    members = data.get("members") or []
    current_data = data.get("currentData") or []

    old_member_indices = [
        i for i, m in enumerate(members)
        if isinstance(m, dict) and str(m.get("id") or "") == KAI2_OLD_ID
    ]
    new_member_indices = [
        i for i, m in enumerate(members)
        if isinstance(m, dict) and str(m.get("id") or "") == KAI2_NEW_ID
    ]

    report["members_removed"] = 0
    report["current_data_removed"] = 0
    report["member_fields_merged"] = []

    if not old_member_indices:
        return

    if new_member_indices:
        canonical_idx = new_member_indices[0]
        for old_idx in old_member_indices:
            merged = merge_member_fields(members[canonical_idx], members[old_idx])
            if merged:
                report["member_fields_merged"].extend(merged)
        remove_member_indices = set(old_member_indices)
    else:
        members[old_member_indices[0]]["id"] = KAI2_NEW_ID
        remove_member_indices = set(old_member_indices[1:])

    report["members_removed"] = len(remove_member_indices)
    if remove_member_indices:
        data["members"] = [m for i, m in enumerate(members) if i not in remove_member_indices]
    else:
        data["members"] = members

    old_current_indices = [
        i for i, cd in enumerate(current_data)
        if isinstance(cd, dict) and str(cd.get("id") or "") == KAI2_OLD_ID
    ]
    new_current_indices = [
        i for i, cd in enumerate(current_data)
        if isinstance(cd, dict) and str(cd.get("id") or "") == KAI2_NEW_ID
    ]
    if new_current_indices and old_current_indices:
        for old_idx in old_current_indices:
            merge_member_fields(current_data[new_current_indices[0]], current_data[old_idx])
    elif old_current_indices and not new_current_indices:
        current_data[old_current_indices[0]]["id"] = KAI2_NEW_ID
        old_current_indices = old_current_indices[1:]

    report["current_data_removed"] = len(old_current_indices)
    if old_current_indices:
        data["currentData"] = [cd for i, cd in enumerate(current_data) if i not in set(old_current_indices)]
    else:
        data["currentData"] = current_data


REVENUE_ACCOUNT_BUCKETS = ("ramAccounts", "orcaAccounts", "caryAccounts", "accounts")


def unify_revenue_log(revenue_log: dict, report: dict) -> None:
    for date_key, entry in revenue_log.items():
        if not isinstance(entry, dict):
            continue

        had_old_any = False
        had_collision = False

        for bucket in REVENUE_ACCOUNT_BUCKETS:
            container = entry.get(bucket)
            if not isinstance(container, dict) or KAI2_OLD_ID not in container:
                continue

            had_old_any = True
            had_old = True
            had_new = KAI2_NEW_ID in container
            ctx = f"revenueLog.{date_key}.{bucket}"
            rename_dict_key(container, KAI2_OLD_ID, KAI2_NEW_ID, report, ctx)
            if had_old and had_new:
                had_collision = True

        if had_old_any:
            report["revenue_dates_touched"].append(date_key)
        if had_collision:
            revenue_log[date_key] = recalc_revenue_entry(entry)
            report["revenue_recalc_dates"].append(date_key)


def unify_sales_log(sales_log: dict, report: dict) -> None:
    for date_key, entry in sales_log.items():
        if not isinstance(entry, dict):
            continue

        acc = entry.setdefault("accounts", {})
        if not isinstance(acc, dict) or KAI2_OLD_ID not in acc:
            continue

        had_old = True
        had_new = KAI2_NEW_ID in acc
        ctx = f"salesLog.{date_key}.accounts"
        rename_dict_key(acc, KAI2_OLD_ID, KAI2_NEW_ID, report, ctx)
        report["sales_dates_touched"].append(date_key)
        if had_old and had_new:
            sales_log[date_key] = recalc_sales_entry(entry)
            report["sales_recalc_dates"].append(date_key)


def sweep_old_dict_keys(obj: Any, report: dict, path: str = "") -> None:
    """Rename any remaining dict keys that still use the old kai2 ID."""
    if isinstance(obj, dict):
        if KAI2_OLD_ID in obj:
            rename_dict_key(obj, KAI2_OLD_ID, KAI2_NEW_ID, report, path or "<root>")
        for key, value in list(obj.items()):
            child_path = f"{path}.{key}" if path else str(key)
            sweep_old_dict_keys(value, report, child_path)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            sweep_old_dict_keys(value, report, f"{path}[{index}]")


def build_orca_org_chart(settings: dict) -> dict:
    accounts = settings.get("orcaInputAccounts") or []
    members: list[dict] = []
    root_account_ids: list[str] = []
    for acc in accounts:
        if not isinstance(acc, dict) or not acc.get("id"):
            continue
        username = str(acc.get("username") or acc.get("name") or "未入力").lstrip("@")
        name = str(acc.get("name") or username or "未入力")
        members.append(
            {
                "id": acc["id"],
                "parent": None,
                "name": name,
                "username": username,
                "rank": int(acc.get("rank") or 0),
                "investment": float(acc.get("investment") or 0),
                "aiAgent": acc.get("aiAgent") or "不明",
                "personalSales": float(acc.get("personalSales") or 0),
                "groupSales": float(acc.get("groupSales") or 0),
                "open": True,
                "bvMode": "MANUAL",
                "bvPrompted": False,
            }
        )
        root_account_ids.append(acc["id"])
    if not members:
        return {
            "members": [],
            "currentData": [],
            "scenarios": [],
            "rootId": "",
            "rootAccountIds": [],
            "zoom": 1,
        }
    cloned = copy.deepcopy(members)
    return {
        "members": members,
        "currentData": cloned,
        "scenarios": [],
        "rootId": root_account_ids[0],
        "rootAccountIds": root_account_ids,
        "zoom": 1,
    }


def orca_org_has_hierarchy(chart: dict) -> bool:
    members = chart.get("members") or []
    return any(isinstance(m, dict) and m.get("parent") for m in members)


def orca_org_score(chart: dict) -> tuple[int, int]:
    members = chart.get("members") or []
    with_parent = sum(1 for m in members if isinstance(m, dict) and m.get("parent"))
    return with_parent, len(members)


def ensure_orca_org_chart(data: dict) -> dict:
    chart = data.get("orcaOrgChart")
    if isinstance(chart, dict) and chart.get("members"):
        if orca_org_has_hierarchy(chart):
            return chart
        rebuilt = build_orca_org_chart(data.get("settings") or {})
        if orca_org_score(chart) >= orca_org_score(rebuilt):
            return chart
    return build_orca_org_chart(data.get("settings") or {})


def unify_kai2_ids(data: dict) -> tuple[dict, dict]:
    out = copy.deepcopy(data)
    settings = out.setdefault("settings", {})
    report: dict[str, Any] = {
        "old_id": KAI2_OLD_ID,
        "new_id": KAI2_NEW_ID,
        "keys_renamed": 0,
        "keys_removed": 0,
        "collision_keys_dropped": 0,
        "collisions": [],
        "revenue_dates_touched": [],
        "sales_dates_touched": [],
        "revenue_recalc_dates": [],
        "sales_recalc_dates": [],
        "investment_history_merged": 0,
        "investment_history_renamed": 0,
        "investment_history_records_appended": 0,
        "members_removed": 0,
        "current_data_removed": 0,
        "member_fields_merged": [],
        "sweep_keys_renamed": 0,
        "sweep_keys_removed": 0,
    }

    unify_revenue_log(settings.get("revenueLog") or {}, report)
    unify_sales_log(settings.get("salesLog") or {}, report)
    unify_investment_history(settings.get("investmentHistory"), report)
    remove_duplicate_old_kai2_slots(out, report)

    before_sweep_renamed = report["keys_renamed"]
    before_sweep_removed = report["keys_removed"]
    sweep_old_dict_keys(out, report)
    report["sweep_keys_renamed"] = report["keys_renamed"] - before_sweep_renamed
    report["sweep_keys_removed"] = report["keys_removed"] - before_sweep_removed

    settings["lastUpdate"] = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    out["orcaOrgChart"] = ensure_orca_org_chart(out)
    return out, report


def counts(data: dict) -> dict[str, int]:
    settings = data.get("settings") or {}
    return {
        "members": len(data.get("members") or []),
        "rootAccountIds": len(data.get("rootAccountIds") or []),
        "currentData": len(data.get("currentData") or []),
        "revenueLog": len(settings.get("revenueLog") or {}),
        "salesLog": len(settings.get("salesLog") or {}),
    }


def kai2_log_stats(data: dict, account_id: str = KAI2_NEW_ID) -> dict[str, int]:
    settings = data.get("settings") or {}
    rev_dates: set[str] = set()
    sales_dates: set[str] = set()

    for dk, entry in (settings.get("revenueLog") or {}).items():
        ra = (entry or {}).get("ramAccounts") or {}
        if account_id in ra and has_ram_revenue(ra[account_id]):
            rev_dates.add(dk)

    for dk, entry in (settings.get("salesLog") or {}).items():
        acc = (entry or {}).get("accounts") or {}
        ae = acc.get(account_id)
        if ae and (not ae.get("projectKey") or ae.get("projectKey") == "ram") and has_ram_sales(ae):
            sales_dates.add(dk)

    return {
        "kai2_revenue_dates": len(rev_dates),
        "kai2_sales_dates": len(sales_dates),
    }


def count_old_id_occurrences(data: dict, old_id: str) -> int:
    return json.dumps(data, ensure_ascii=False).count(old_id)


def validate_unified(data: dict) -> dict[str, Any]:
    members_list = [m for m in data.get("members") or [] if isinstance(m, dict) and m.get("id")]

    def member_by_id(account_id: str) -> dict | None:
        for member in members_list:
            if member.get("id") == account_id:
                return member
        return None

    roots = data.get("rootAccountIds") or []
    root_users = [
        norm_username((member_by_id(rid) or {}).get("username")) for rid in roots
    ]

    yone = [
        m for m in members_list
        if "米永" in str(m.get("name") or "") or "米永" in str(m.get("username") or "")
    ]

    settings = data.get("settings") or {}
    rev = settings.get("revenueLog") or {}
    sales = settings.get("salesLog") or {}

    rev_double = 0
    for entry in rev.values():
        ra = (entry or {}).get("ramAccounts") or {}
        if KAI2_OLD_ID in ra and KAI2_NEW_ID in ra:
            rev_double += 1

    sales_double = 0
    for entry in sales.values():
        acc = (entry or {}).get("accounts") or {}
        if KAI2_OLD_ID in acc and KAI2_NEW_ID in acc:
            sales_double += 1

    return {
        "old_id_remaining": count_old_id_occurrences(data, KAI2_OLD_ID),
        "new_id_present": count_old_id_occurrences(data, KAI2_NEW_ID) > 0,
        "members_count": len(data.get("members") or []),
        "current_data_count": len(data.get("currentData") or []),
        "members_with_new_id": sum(
            1 for m in (data.get("members") or [])
            if isinstance(m, dict) and m.get("id") == KAI2_NEW_ID
        ),
        "root_usernames": root_users,
        "has_kai3_to_kai8": all(f"kai{i}" in root_users for i in range(3, 9)),
        "yone_member_count": len(yone),
        "kai2_root_ids": [
            rid for rid in roots
            if norm_username((member_by_id(rid) or {}).get("username")) == "kai2"
        ],
        "revenue_double_key_days": rev_double,
        "sales_double_key_days": sales_double,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Unify kai2 account IDs in a .hub file (read-only source)")
    parser.add_argument(
        "--input",
        "--a",
        dest="input",
        required=True,
        help="Path to source .hub file (typically A / Mac official backup)",
    )
    parser.add_argument(
        "--out",
        default="",
        help="Output .hub path (default: merge-output/OUKEI_HUB_KAI2_UNIFIED_YYYYMMDD.hub)",
    )
    args = parser.parse_args()

    path_in = Path(args.input).expanduser()
    if not path_in.is_file():
        print(f"ERROR: input not found: {path_in}", file=sys.stderr)
        return 1

    source = load_hub(path_in)
    unified, op_report = unify_kai2_ids(source)

    out = Path(args.out).expanduser() if args.out else Path(
        f"merge-output/OUKEI_HUB_KAI2_UNIFIED_{datetime.now().strftime('%Y%m%d')}.hub"
    )
    save_hub(unified, out)

    c_src = counts(source)
    c_out = counts(unified)
    k_src = kai2_log_stats(source)
    k_out_new = kai2_log_stats(unified, KAI2_NEW_ID)
    k_src_old = kai2_log_stats(source, KAI2_OLD_ID)
    val = validate_unified(unified)

    print("=== COUNT COMPARISON (source → unified) ===")
    print(f"{'field':<18} {'source':>8} {'unified':>8}")
    for key in c_src:
        print(f"{key:<18} {c_src[key]:>8} {c_out[key]:>8}")

    print("\n=== KAI2 LOG COVERAGE ===")
    print(f"{'metric':<22} {'source(new)':>12} {'source(old)':>12} {'unified(new)':>12}")
    print(
        f"{'kai2_revenue_dates':<22} {k_src['kai2_revenue_dates']:>12} "
        f"{k_src_old['kai2_revenue_dates']:>12} {k_out_new['kai2_revenue_dates']:>12}"
    )
    print(
        f"{'kai2_sales_dates':<22} {k_src['kai2_sales_dates']:>12} "
        f"{k_src_old['kai2_sales_dates']:>12} {k_out_new['kai2_sales_dates']:>12}"
    )

    print("\n=== ID UNIFICATION REPORT ===")
    print(f"Old ID: {op_report['old_id']}")
    print(f"New ID: {op_report['new_id']}")
    print(f"Dict keys renamed (old→new): {op_report['keys_renamed']}")
    print(f"Old dict keys removed total: {op_report['keys_removed']}")
    print(f"Collision days (kept new, dropped old): {op_report['collision_keys_dropped']}")
    print(f"Revenue dates touched: {len(op_report['revenue_dates_touched'])}")
    print(f"Sales dates touched: {len(op_report['sales_dates_touched'])}")
    print(f"Revenue recalc dates: {len(op_report['revenue_recalc_dates'])}")
    print(f"Sales recalc dates: {len(op_report['sales_recalc_dates'])}")
    print(f"investmentHistory merged: {op_report['investment_history_merged']}")
    print(f"investmentHistory records appended: {op_report['investment_history_records_appended']}")
    print(f"Duplicate members removed: {op_report['members_removed']}")
    print(f"Duplicate currentData removed: {op_report['current_data_removed']}")
    if op_report.get("member_fields_merged"):
        print("Canonical member fields filled:", sorted(set(op_report["member_fields_merged"])))
    if op_report.get("sweep_keys_renamed"):
        print(f"Sweep extra keys renamed: {op_report['sweep_keys_renamed']}")
    if op_report.get("sweep_keys_removed"):
        print(f"Sweep extra keys removed: {op_report['sweep_keys_removed']}")

    print("\n=== FINAL VALIDATION ===")
    for k, v in val.items():
        print(f"{k}: {v}")

    print(f"\nOUTPUT: {out.resolve()}")
    print("Source file was not modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
