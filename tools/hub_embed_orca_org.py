#!/usr/bin/env python3
"""Embed a full orcaOrgChart snapshot into a unified .hub file."""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def extract_orca_chart(raw: dict) -> dict | None:
    chart = raw.get("orcaOrgChart")
    if isinstance(chart, dict) and chart.get("members"):
        return chart
    members = raw.get("members")
    if isinstance(members, list) and members:
        return {
            "members": members,
            "currentData": copy.deepcopy(members),
            "scenarios": raw.get("scenarios") or [],
            "rootId": raw.get("rootId") or "",
            "rootAccountIds": raw.get("rootAccountIds") or [],
            "zoom": raw.get("zoom") if isinstance(raw.get("zoom"), (int, float)) else 1,
        }
    return None


def chart_stats(chart: dict) -> dict[str, int]:
    members = chart.get("members") or []
    with_parent = sum(1 for m in members if isinstance(m, dict) and m.get("parent"))
    roots = sum(1 for m in members if isinstance(m, dict) and not m.get("parent"))
    return {
        "members": len(members),
        "withParent": with_parent,
        "roots": roots,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Embed ORCA org chart into unified hub")
    parser.add_argument(
        "--hub",
        default="merge-output/OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub",
        help="Target .hub file",
    )
    parser.add_argument(
        "--snapshot",
        default="merge-input/ORCA_ORG_SNAPSHOT.json",
        help="ORCA org chart snapshot (orcaOrgChart or share package)",
    )
    parser.add_argument("--out", default="", help="Output path (default: overwrite --hub)")
    args = parser.parse_args()

    hub_path = Path(args.hub)
    snap_path = Path(args.snapshot)
    out_path = Path(args.out) if args.out else hub_path

    if not hub_path.exists():
        raise SystemExit(f"hub not found: {hub_path}")
    if not snap_path.exists():
        raise SystemExit(f"snapshot not found: {snap_path}")

    hub = load_json(hub_path)
    snap = load_json(snap_path)
    chart = extract_orca_chart(snap)
    if not chart:
        raise SystemExit("snapshot does not contain ORCA members")

    stats = chart_stats(chart)
    if stats["withParent"] < 1:
        raise SystemExit(
            f"snapshot has no parent/child links (members={stats['members']}); refusing shallow embed"
        )

    hub["orcaOrgChart"] = chart
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(hub, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(
        f"Embedded ORCA org into {out_path} "
        f"(members={stats['members']} withParent={stats['withParent']} roots={stats['roots']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
