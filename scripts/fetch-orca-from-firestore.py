#!/usr/bin/env python3
"""Fetch orcaOrgChart from Firestore users/{uid}/hubData/main and save snapshot."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "oukei-hub"
OUT_PATH = os.path.join(ROOT, "merge-input", "ORCA_ORG_SNAPSHOT.json")
CFG_PATH = os.path.expanduser("~/.config/configstore/firebase-tools.json")
CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9pVJ8S0X5TyJ2qN2xT3"


def load_cfg() -> dict[str, Any]:
    with open(CFG_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def refresh_access_token(tokens: dict[str, Any]) -> str:
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


def get_access_token() -> str:
    cfg = load_cfg()
    tokens = cfg.get("tokens") or {}
    expires_at = float(tokens.get("expires_at") or 0)
    if time.time() < expires_at - 60 and tokens.get("access_token"):
        return tokens["access_token"]
    return refresh_access_token(tokens)


def decode_uid_from_id_token(id_token: str) -> str:
    payload = id_token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload))
    return str(data.get("user_id") or data.get("sub") or "")


def firestore_value_to_python(value: dict[str, Any]) -> Any:
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
    if "arrayValue" in value:
        return [
            firestore_value_to_python(item)
            for item in value["arrayValue"].get("values", [])
        ]
    if "mapValue" in value:
        fields = value["mapValue"].get("fields") or {}
        return {k: firestore_value_to_python(v) for k, v in fields.items()}
    return None


def firestore_get(access_token: str, path: str) -> dict[str, Any] | None:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
        f"/databases/(default)/documents/{path}"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return None
        raise


def list_user_ids(access_token: str) -> list[str]:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
        f"/databases/(default)/documents/users?pageSize=100"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)
    ids: list[str] = []
    for doc in payload.get("documents") or []:
        name = doc.get("name") or ""
        ids.append(name.split("/")[-1])
    return ids


def extract_orca_chart(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    fields = doc.get("fields") or {}
    raw = fields.get("orcaOrgChart")
    if not raw:
        return None
    chart = firestore_value_to_python(raw)
    if not isinstance(chart, dict):
        return None
    return chart


def chart_stats(chart: dict[str, Any]) -> dict[str, int]:
    members = chart.get("members") or []
    with_parent = sum(1 for m in members if isinstance(m, dict) and m.get("parent"))
    roots = sum(1 for m in members if isinstance(m, dict) and not m.get("parent"))
    return {
        "members": len(members),
        "withParent": with_parent,
        "roots": roots,
    }


def main() -> int:
    access = get_access_token()
    cfg = load_cfg()
    preferred_uid = decode_uid_from_id_token((cfg.get("tokens") or {}).get("id_token", ""))

    candidates: list[tuple[str, dict[str, Any]]] = []
    uids = [preferred_uid] if preferred_uid else []
    for uid in list_user_ids(access):
        if uid not in uids:
            uids.append(uid)

    for uid in uids:
        doc = firestore_get(access, f"users/{uid}/hubData/main")
        chart = extract_orca_chart(doc)
        if not chart:
            continue
        stats = chart_stats(chart)
        updated = firestore_value_to_python((doc.get("fields") or {}).get("updatedAt") or {})
        candidates.append(
            (
                uid,
                {
                    "uid": uid,
                    "updatedAt": updated,
                    "stats": stats,
                    "orcaOrgChart": chart,
                },
            )
        )

    if not candidates:
        print("No orcaOrgChart found in Firestore hubData/main documents.")
        return 1

    def score(item: tuple[str, dict[str, Any]]) -> tuple[int, int, int]:
        stats = item[1]["stats"]
        return (stats["withParent"], stats["members"], int(item[1].get("updatedAt") or 0))

    best_uid, best = max(candidates, key=score)
    stats = best["stats"]
    print(
        f"Selected uid={best_uid} members={stats['members']} "
        f"withParent={stats['withParent']} roots={stats['roots']}"
    )

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(best["orcaOrgChart"], fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"Saved {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
