#!/usr/bin/env python3
"""Restore ENI orphan nodes in production Firestore hubData/main.

Cause: parent accounts were deleted via self-only delete, leaving children
pointing at removed IDs. Original parent names/parents are not recoverable.

Restore policy (no stub parents):
  - Reparent direct orphans to current root (kai1), matching seriesRootId
  - Keep grandchild links intact (亜子 → 荒川 unchanged)
  - Keep removedEniOrgAccountIds tombstones (deleted parents stay deleted)
  - Touch only eniOrgChart (+ settings.lastUpdate / updatedAt / schemaVersion)

Usage:
  python3 scripts/restore-eni-orphans-to-firestore.py
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "merge-input")
VERSION_PATH = os.path.join(ROOT, "assets", "hub-app-version.json")
PROJECT = "oukei-hub"
UID = "HLoBjIRi7Wgt14crc82ey613Njy1"
CFG_PATH = os.path.expanduser("~/.config/configstore/firebase-tools.json")

# Direct orphans (parent missing). 荒川 stays under 亜子.
ORPHAN_REPARENT = {
    "eni_1784188565683": "浅田",  # was under eni_1784123085986
    "eni_1784645764795": "亜子",  # was under eni_1784123085986
    "eni_1784646223095": "下中",  # was under eni_1784122607417
}
EXPECTED_NAMES = {
    "eni_1784188565683": "浅田",
    "eni_1784645764795": "亜子",
    "eni_1784645783878": "荒川",
    "eni_1784646223095": "下中",
}
MISSING_PARENTS = {"eni_1784123085986", "eni_1784122607417"}


def load_json(path: str) -> Any:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


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
    """Use access_token already refreshed by `npx firebase` CLI (expires_at is ms)."""
    cfg = load_json(CFG_PATH)
    tokens = cfg.get("tokens") or {}
    access = tokens.get("access_token")
    expires_at = float(tokens.get("expires_at") or 0)
    now_ms = time.time() * 1000
    if not access:
        raise SystemExit("No Firebase access_token. Run: npx firebase projects:list")
    if expires_at and expires_at < now_ms + 60_000:
        raise SystemExit(
            "Firebase access_token expired. Refresh by running: npx firebase projects:list"
        )
    return access


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


def patch_eni(token: str, eni: dict[str, Any], settings: dict[str, Any],
              schema_version: int, updated_at: int) -> None:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/"
        f"documents/users/{UID}/hubData/main"
        f"?updateMask.fieldPaths=eniOrgChart"
        f"&updateMask.fieldPaths=settings"
        f"&updateMask.fieldPaths=schemaVersion"
        f"&updateMask.fieldPaths=updatedAt"
    )
    body = {
        "fields": {
            "eniOrgChart": py_to_fs(eni),
            "settings": py_to_fs(settings),
            "schemaVersion": py_to_fs(schema_version),
            "updatedAt": py_to_fs(updated_at),
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


def analyze(eni: dict[str, Any]) -> dict[str, Any]:
    members = [m for m in (eni.get("members") or []) if isinstance(m, dict) and m.get("id")]
    by = {m["id"]: m for m in members}
    root = eni.get("rootId")
    seen: set[str] = set()
    stack = [root] if root else []
    while stack:
        x = stack.pop()
        if not x or x in seen:
            continue
        seen.add(x)
        for m in members:
            if m.get("parent") == x:
                stack.append(m["id"])
    orphans = [m for m in members if m["id"] not in seen]
    missing_parent_refs = [
        m for m in members if m.get("parent") and m.get("parent") not in by
    ]
    return {
        "memberCount": len(members),
        "reachableCount": len(seen),
        "reachableNames": sorted(by[i].get("name") or i for i in seen if i in by),
        "orphanNames": sorted(m.get("name") or m["id"] for m in orphans),
        "missingParentRefCount": len(missing_parent_refs),
        "treeEdges": [
            {
                "id": m["id"],
                "name": m.get("name"),
                "parent": m.get("parent"),
            }
            for m in sorted(members, key=lambda x: x.get("name") or "")
        ],
    }


def apply_restore(cloud: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    out = deepcopy(cloud)
    eni = out.setdefault("eniOrgChart", {})
    members = eni.setdefault("members", [])
    settings = out.setdefault("settings", {})
    root_id = eni.get("rootId")
    if not root_id:
        raise SystemExit("eniOrgChart.rootId missing")

    by = {m["id"]: m for m in members if isinstance(m, dict) and m.get("id")}
    report: dict[str, Any] = {
        "reparented": [],
        "unchangedChildLinks": [],
        "skipped": [],
        "newParent": root_id,
        "newParentName": (by.get(root_id) or {}).get("name"),
    }

    # Verify expected names still present
    for iid, name in EXPECTED_NAMES.items():
        m = by.get(iid)
        if not m:
            raise SystemExit(f"Expected member missing: {name} ({iid})")
        if m.get("name") != name:
            raise SystemExit(f"Name mismatch for {iid}: {m.get('name')} != {name}")

    # Max sortOrder among current root children
    max_order = -1
    for m in members:
        if m.get("parent") == root_id:
            try:
                max_order = max(max_order, int(m.get("sortOrder") or 0))
            except (TypeError, ValueError):
                pass
    next_order = max_order + 1

    for iid, name in ORPHAN_REPARENT.items():
        m = by[iid]
        old_parent = m.get("parent")
        if old_parent == root_id:
            report["skipped"].append({"id": iid, "name": name, "reason": "already under root"})
            continue
        if old_parent not in MISSING_PARENTS and old_parent in by:
            report["skipped"].append({
                "id": iid,
                "name": name,
                "reason": f"parent exists: {old_parent}",
            })
            continue
        m["parent"] = root_id
        m["seriesRootId"] = root_id
        # inherit seriesIndex from root if present
        root_m = by.get(root_id) or {}
        if root_m.get("seriesIndex") is not None:
            m["seriesIndex"] = root_m.get("seriesIndex")
        m["sortOrder"] = next_order
        next_order += 1
        m["open"] = True if m.get("open") is None else m.get("open")
        report["reparented"].append({
            "id": iid,
            "name": name,
            "fromParent": old_parent,
            "toParent": root_id,
            "sortOrder": m["sortOrder"],
        })

    # Confirm 荒川 → 亜子 unchanged
    arakawa = by["eni_1784645783878"]
    if arakawa.get("parent") != "eni_1784645764795":
        raise SystemExit("荒川 parent unexpectedly changed before write")
    report["unchangedChildLinks"].append({
        "child": "荒川",
        "childId": "eni_1784645783878",
        "parent": "亜子",
        "parentId": "eni_1784645764795",
    })

    settings["lastUpdate"] = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    out["updatedAt"] = int(time.time() * 1000)
    return out, report


def main() -> None:
    # Ensure CLI token is fresh
    os.system("npx --yes firebase projects:list >/dev/null 2>&1")
    token = get_access_token()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    cloud = fetch_doc(token)

    backup_path = os.path.join(OUT_DIR, f"ENI_PROD_BACKUP_before_orphan_restore_{stamp}.json")
    save_json(backup_path, cloud)
    print("BACKUP", backup_path)

    before = analyze(cloud.get("eniOrgChart") or {})
    print("BEFORE", json.dumps(before, ensure_ascii=False, indent=2))

    patched, report = apply_restore(cloud)
    after_local = analyze(patched.get("eniOrgChart") or {})
    print("PLAN", json.dumps(report, ensure_ascii=False, indent=2))
    print("AFTER_LOCAL", json.dumps(after_local, ensure_ascii=False, indent=2))

    if after_local["missingParentRefCount"] != 0:
        raise SystemExit("Restore plan still has missing parent refs")
    if after_local["reachableCount"] != after_local["memberCount"]:
        raise SystemExit("Restore plan does not make all nodes reachable")
    if set(after_local["orphanNames"]):
        raise SystemExit(f"Orphans remain in plan: {after_local['orphanNames']}")

    schema_version = load_required_schema_version()
    payload_path = os.path.join(OUT_DIR, f"ENI_PROD_RESTORE_PAYLOAD_{stamp}.json")
    save_json(payload_path, {
        "report": report,
        "before": before,
        "afterLocal": after_local,
        "updatedAt": patched.get("updatedAt"),
    })

    print(f"WRITING eniOrgChart to users/{UID}/hubData/main ...")
    patch_eni(
        token,
        patched["eniOrgChart"],
        patched["settings"],
        schema_version,
        int(patched["updatedAt"]),
    )

    verify_doc = fetch_doc(token)
    verify = analyze(verify_doc.get("eniOrgChart") or {})
    verify_path = os.path.join(OUT_DIR, f"ENI_PROD_VERIFY_after_orphan_restore_{stamp}.json")
    save_json(verify_path, {"verify": verify, "report": report})
    print("VERIFY", json.dumps(verify, ensure_ascii=False, indent=2))

    ok = (
        verify["memberCount"] == 8
        and verify["reachableCount"] == 8
        and verify["missingParentRefCount"] == 0
        and not verify["orphanNames"]
        and set(EXPECTED_NAMES.values()).issubset(set(verify["reachableNames"]))
    )
    # 荒川 still under 亜子
    by = {m["id"]: m for m in (verify_doc.get("eniOrgChart") or {}).get("members") or []}
    ok = ok and by.get("eni_1784645783878", {}).get("parent") == "eni_1784645764795"
    for iid in ORPHAN_REPARENT:
        ok = ok and by.get(iid, {}).get("parent") == (verify_doc.get("eniOrgChart") or {}).get("rootId")

    print("RESULT", "SUCCESS" if ok else "FAIL")
    print("BACKUP_FILE", backup_path)
    print("VERIFY_FILE", verify_path)
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
