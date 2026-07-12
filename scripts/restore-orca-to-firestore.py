#!/usr/bin/env python3
"""Restore ORCA-only fields from localhost snapshot into production Firestore hubData/main.

- Backs up current production doc first
- Touches only ORCA-related fields (no RAM/ENI/orcaOrgChart mutation)
- Does NOT redeploy hosting
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "merge-input")
LOCAL_PATH = os.path.join(OUT_DIR, "ORCA_LOCAL_5050_SNAPSHOT.json")
VERSION_PATH = os.path.join(ROOT, "assets", "hub-app-version.json")
PROJECT = "oukei-hub"
UID = "HLoBjIRi7Wgt14crc82ey613Njy1"
TARGET_IDS = ["orca_1783005565893", "orca_1783005577176"]
CFG_PATH = os.path.expanduser("~/.config/configstore/firebase-tools.json")
CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9pVJ8S0X5TyJ2qN2xT3"


def load_json(path: str) -> Any:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def load_required_schema_version() -> int:
    data = load_json(VERSION_PATH)
    version = (data or {}).get("schemaVersion")
    try:
        version_int = int(version)
    except (TypeError, ValueError):
        version_int = 0
    if version_int <= 0:
        raise SystemExit(f"Missing schemaVersion in {VERSION_PATH}")
    return version_int


def get_access_token() -> str:
    cfg = load_json(CFG_PATH)
    tokens = cfg.get("tokens") or {}
    expires_at = float(tokens.get("expires_at") or 0)
    if time.time() < expires_at - 60 and tokens.get("access_token"):
        return tokens["access_token"]
    data = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": tokens["refresh_token"],
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }
    ).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)
    return payload["access_token"]


def fs_to_py(value: dict[str, Any] | None) -> Any:
    if value is None:
        return None
    if "nullValue" in value:
        return None
    if "booleanValue" in value:
        return value["booleanValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "stringValue" in value:
        return value["stringValue"]
    if "timestampValue" in value:
        return value["timestampValue"]
    if "arrayValue" in value:
        return [fs_to_py(v) for v in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        fields = value["mapValue"].get("fields") or {}
        return {k: fs_to_py(v) for k, v in fields.items()}
    return None


def py_to_fs(value: Any) -> dict[str, Any]:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int) and not isinstance(value, bool):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [py_to_fs(v) for v in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: py_to_fs(v) for k, v in value.items()}}}
    raise TypeError(f"Unsupported type: {type(value)}")


def fetch_doc(token: str) -> dict[str, Any]:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/"
        f"documents/users/{UID}/hubData/main"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        doc = json.load(resp)
    fields = doc.get("fields") or {}
    return {k: fs_to_py(v) for k, v in fields.items()}


def patch_doc(token: str, data: dict[str, Any]) -> None:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/"
        f"documents/users/{UID}/hubData/main"
        f"?updateMask.fieldPaths=settings"
        f"&updateMask.fieldPaths=revenue"
        f"&updateMask.fieldPaths=schemaVersion"
        f"&updateMask.fieldPaths=updatedAt"
    )
    body = {
        "fields": {
            "settings": py_to_fs(data["settings"]),
            "revenue": py_to_fs(data["revenue"]),
            "schemaVersion": py_to_fs(data["schemaVersion"]),
            "updatedAt": py_to_fs(data["updatedAt"]),
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp.read()


def recalc_orca_total(oa: dict[str, Any]) -> float:
    total = 0.0
    for ae in oa.values():
        if not isinstance(ae, dict):
            continue
        if ae.get("yesterdayAiProfit") is not None or ae.get("todayAffiliateProfit") is not None:
            total += float(ae.get("yesterdayAiProfit") or 0) + float(ae.get("todayAffiliateProfit") or 0)
        elif ae.get("todayRevenue") is not None:
            total += float(ae.get("todayRevenue") or 0)
        elif ae.get("revenueUsd") is not None:
            total += float(ae.get("revenueUsd") or 0)
    return round(total, 4)


def apply_orca_restore(cloud: dict[str, Any], local: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    out = deepcopy(cloud)
    settings = out.setdefault("settings", {})
    revenue = out.setdefault("revenue", {})
    revenue_log = revenue.setdefault("revenueLog", {})
    sales_log = revenue.setdefault("salesLog", {})
    inv = settings.setdefault("investmentHistory", {})
    report: dict[str, Any] = {
        "accountsRestored": [],
        "tombstonesRemoved": [],
        "tombstoneTimesRemoved": [],
        "revenueDaysPatched": [],
        "revenueDaysCreated": [],
        "salesDaysPatched": [],
        "salesDaysCreated": [],
        "investmentIdsRestored": [],
        "skipped": [],
    }

    # 1) orcaInputAccounts in kai1 → kai2 order
    by_id = {a.get("id"): a for a in (local.get("orcaInputAccounts") or []) if isinstance(a, dict) and a.get("id")}
    accounts = []
    for tid in TARGET_IDS:
        if tid in by_id:
            accounts.append(deepcopy(by_id[tid]))
    if len(accounts) != 2:
        raise SystemExit(f"Expected 2 target accounts in snapshot, got {len(accounts)}: {list(by_id)}")
    settings["orcaInputAccounts"] = accounts
    report["accountsRestored"] = accounts

    # 2) remove kai1/kai2 tombstones only
    removed = list(settings.get("removedOrcaOrgAccountIds") or [])
    keep = []
    for rid in removed:
        if rid in TARGET_IDS:
            report["tombstonesRemoved"].append(rid)
        else:
            keep.append(rid)
    settings["removedOrcaOrgAccountIds"] = keep
    times = settings.get("removedOrcaOrgAccountIdTimes")
    if isinstance(times, dict):
        for tid in TARGET_IDS:
            if tid in times:
                del times[tid]
                report["tombstoneTimesRemoved"].append(tid)
        settings["removedOrcaOrgAccountIdTimes"] = times

    # 3) revenueLog ORCA-only merge
    local_rev = local.get("revenueLogOrcaOnly") or {}
    for dk, payload in sorted(local_rev.items()):
        oa = deepcopy(payload.get("orcaAccounts") or {})
        accounts_orca = deepcopy(payload.get("accountsOrca") or {})
        orca_total = payload.get("orca")
        if orca_total is None:
            orca_total = recalc_orca_total(oa)

        if dk in revenue_log and isinstance(revenue_log[dk], dict):
            entry = revenue_log[dk]
            entry["orcaAccounts"] = oa
            entry["orca"] = orca_total
            entry.setdefault("accounts", {})
            for aid in list(entry.get("accounts") or {}):
                ae = entry["accounts"].get(aid)
                if isinstance(ae, dict) and ae.get("projectKey") == "orca" and aid in TARGET_IDS:
                    del entry["accounts"][aid]
            if accounts_orca:
                for aid, ae in accounts_orca.items():
                    entry["accounts"][aid] = ae
            else:
                for aid, ae in oa.items():
                    total = 0.0
                    if ae.get("yesterdayAiProfit") is not None or ae.get("todayAffiliateProfit") is not None:
                        total = float(ae.get("yesterdayAiProfit") or 0) + float(ae.get("todayAffiliateProfit") or 0)
                    elif ae.get("todayRevenue") is not None:
                        total = float(ae.get("todayRevenue") or 0)
                    elif ae.get("revenueUsd") is not None:
                        total = float(ae.get("revenueUsd") or 0)
                    entry["accounts"][aid] = {
                        "projectKey": "orca",
                        "todayRevenue": round(total, 4),
                        "operationRevenue": 0,
                    }
            proj_keys = ["ram", "orca", "cary", "genesis", "eni", "other"]
            if any(k in entry for k in proj_keys):
                entry["total"] = round(sum(float(entry.get(k) or 0) for k in proj_keys), 2)
            report["revenueDaysPatched"].append(dk)
        else:
            entry = {
                "orcaAccounts": oa,
                "orca": orca_total,
                "ram": 0,
                "cary": 0,
                "genesis": 0,
                "eni": 0,
                "other": 0,
                "accounts": {},
                "savedAt": datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
            }
            if accounts_orca:
                entry["accounts"] = accounts_orca
            else:
                for aid, ae in oa.items():
                    total = 0.0
                    if ae.get("yesterdayAiProfit") is not None or ae.get("todayAffiliateProfit") is not None:
                        total = float(ae.get("yesterdayAiProfit") or 0) + float(ae.get("todayAffiliateProfit") or 0)
                    elif ae.get("todayRevenue") is not None:
                        total = float(ae.get("todayRevenue") or 0)
                    elif ae.get("revenueUsd") is not None:
                        total = float(ae.get("revenueUsd") or 0)
                    entry["accounts"][aid] = {
                        "projectKey": "orca",
                        "todayRevenue": round(total, 4),
                        "operationRevenue": 0,
                    }
            entry["total"] = round(float(orca_total or 0), 2)
            revenue_log[dk] = entry
            report["revenueDaysCreated"].append(dk)

    # 4) salesLog ORCA-only merge
    local_sales = local.get("salesLogOrcaOnly") or {}
    for dk, payload in sorted(local_sales.items()):
        accounts_map = deepcopy((payload or {}).get("accounts") or {})
        if dk in sales_log and isinstance(sales_log[dk], dict):
            entry = sales_log[dk]
            entry.setdefault("accounts", {})
            for aid in list(entry["accounts"].keys()):
                ae = entry["accounts"].get(aid)
                if isinstance(ae, dict) and ae.get("projectKey") == "orca" and aid in TARGET_IDS:
                    del entry["accounts"][aid]
            for aid, ae in accounts_map.items():
                entry["accounts"][aid] = ae
            report["salesDaysPatched"].append(dk)
        else:
            sales_log[dk] = {"accounts": accounts_map}
            report["salesDaysCreated"].append(dk)

    # 5) investmentHistory for kai1/kai2 only
    local_inv = local.get("investmentHistoryOrcaOnly") or {}
    for aid in TARGET_IDS:
        if aid in local_inv:
            inv[aid] = deepcopy(local_inv[aid])
            report["investmentIdsRestored"].append(aid)

    settings["lastUpdate"] = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    out["updatedAt"] = int(time.time() * 1000)
    return out, report


def summarize_orca(doc: dict[str, Any]) -> dict[str, Any]:
    settings = doc.get("settings") or {}
    revenue_log = ((doc.get("revenue") or {}).get("revenueLog") or {})
    sales_log = ((doc.get("revenue") or {}).get("salesLog") or {})
    inv = settings.get("investmentHistory") or {}
    rev_ids: set[str] = set()
    rev_days = 0
    for e in revenue_log.values():
        if isinstance(e, dict) and e.get("orcaAccounts"):
            rev_days += 1
            rev_ids.update(e["orcaAccounts"].keys())
    sales_days = 0
    sales_ids: set[str] = set()
    for e in sales_log.values():
        if not isinstance(e, dict) or not e.get("accounts"):
            continue
        hit = False
        for aid, ae in e["accounts"].items():
            if isinstance(ae, dict) and ae.get("projectKey") == "orca":
                sales_ids.add(aid)
                hit = True
        if hit:
            sales_days += 1
    return {
        "orcaInputAccounts": settings.get("orcaInputAccounts") or [],
        "removedOrcaOrgAccountIds": settings.get("removedOrcaOrgAccountIds") or [],
        "revenueDaysWithOrcaAccounts": rev_days,
        "revenueAccountIds": sorted(rev_ids),
        "salesDays": sales_days,
        "salesAccountIds": sorted(sales_ids),
        "investmentTargetIdsPresent": [i for i in TARGET_IDS if i in inv],
        "ramInputAccountsCount": len(settings.get("ramInputAccounts") or []),
        "eniInputAccountsCount": len(settings.get("eniInputAccounts") or []),
        "updatedAt": doc.get("updatedAt"),
    }


def main() -> None:
    if not os.path.exists(LOCAL_PATH):
        raise SystemExit(f"Missing snapshot: {LOCAL_PATH}")
    local = load_json(LOCAL_PATH)
    if not local.get("ok", True) and local.get("error"):
        raise SystemExit(f"Snapshot invalid: {local}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    token = get_access_token()
    cloud = fetch_doc(token)
    backup_path = os.path.join(OUT_DIR, f"ORCA_PROD_BACKUP_before_restore_{stamp}.json")
    save_json(backup_path, cloud)
    print("BACKUP", backup_path)

    patched, report = apply_orca_restore(cloud, local)
    print("PLAN", json.dumps(report, ensure_ascii=False, indent=2))
    print("SUMMARY_AFTER_LOCAL", json.dumps(summarize_orca(patched), ensure_ascii=False, indent=2))

    save_json(os.path.join(OUT_DIR, f"ORCA_PROD_RESTORE_PAYLOAD_{stamp}.json"), {
        "settings_orcaInputAccounts": patched["settings"].get("orcaInputAccounts"),
        "removedOrcaOrgAccountIds": patched["settings"].get("removedOrcaOrgAccountIds"),
        "report": report,
        "updatedAt": patched.get("updatedAt"),
    })

    print(f"WRITING to Firestore users/{UID}/hubData/main ...")
    schema_version = load_required_schema_version()
    patch_doc(token, {
        "settings": patched["settings"],
        "revenue": patched["revenue"],
        "schemaVersion": schema_version,
        "updatedAt": patched["updatedAt"],
    })

    verify = fetch_doc(token)
    verify_summary = summarize_orca(verify)
    verify_path = os.path.join(OUT_DIR, f"ORCA_PROD_VERIFY_after_restore_{stamp}.json")
    save_json(verify_path, verify_summary)
    print("VERIFY", json.dumps(verify_summary, ensure_ascii=False, indent=2))

    ok = (
        len(verify_summary["orcaInputAccounts"]) == 2
        and [a.get("id") for a in verify_summary["orcaInputAccounts"]] == TARGET_IDS
        and all(tid not in (verify_summary["removedOrcaOrgAccountIds"] or []) for tid in TARGET_IDS)
        and verify_summary["revenueDaysWithOrcaAccounts"] >= 35
        and verify_summary["salesDays"] >= 7
        and set(verify_summary["investmentTargetIdsPresent"]) == set(TARGET_IDS)
    )
    print("RESULT", "SUCCESS" if ok else "FAIL")
    print("BACKUP_FILE", backup_path)
    print("VERIFY_FILE", verify_path)
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
