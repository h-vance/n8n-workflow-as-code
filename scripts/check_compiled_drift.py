#!/usr/bin/env python3
"""Fail if workflows/compiled/*.json is stale relative to its TypeScript source.

The TypeScript files are the source of truth and the compiled JSON is the
importable artifact, so the two must agree. The failure mode this guards
against is editing a .workflow.ts and committing without regenerating its
JSON, which leaves the repo shipping an artifact that no longer matches the
code describing it.

Node ids are excluded from the comparison. n8nac mints a fresh UUID per node
on every conversion, so they differ on every run and carry no meaning. n8n
wires connections by node *name*, not id, so dropping ids still compares the
graph structure.

Usage:
    python3 scripts/check_compiled_drift.py          # check, exit 1 on drift
    python3 scripts/check_compiled_drift.py --fix    # rewrite compiled JSON
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO / "workflows"
COMPILED_DIR = SOURCE_DIR / "compiled"

# Regenerated per conversion, so comparing them produces noise rather than signal.
VOLATILE_NODE_KEYS = {"id"}


def normalize(doc: dict) -> dict:
    """Drop fields that legitimately change between two conversions."""
    out = json.loads(json.dumps(doc))  # cheap deep copy
    for node in out.get("nodes", []):
        for key in VOLATILE_NODE_KEYS:
            node.pop(key, None)
    return out


def convert(source: Path, dest: Path) -> None:
    subprocess.run(
        ["npx", "n8nac", "convert", str(source), "--format", "json",
         "--output", str(dest), "--force"],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )


def describe_drift(fresh: dict, committed: dict, path: str = "") -> list[str]:
    """Report the first differences in a form that points at the real edit."""
    diffs: list[str] = []
    if type(fresh) is not type(committed):
        return [f"{path}: type {type(fresh).__name__} != {type(committed).__name__}"]

    if isinstance(fresh, dict):
        for key in sorted(set(fresh) | set(committed)):
            if key not in fresh:
                diffs.append(f"{path}.{key}: only in committed JSON")
            elif key not in committed:
                diffs.append(f"{path}.{key}: only in freshly compiled output")
            else:
                diffs += describe_drift(fresh[key], committed[key], f"{path}.{key}")
    elif isinstance(fresh, list):
        if len(fresh) != len(committed):
            diffs.append(f"{path}: {len(fresh)} items compiled, {len(committed)} committed")
        else:
            for i, (a, b) in enumerate(zip(fresh, committed)):
                diffs += describe_drift(a, b, f"{path}[{i}]")
    elif fresh != committed:
        diffs.append(f"{path}: compiled {fresh!r} != committed {committed!r}")

    return diffs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix", action="store_true",
                        help="Rewrite compiled JSON from source instead of failing.")
    args = parser.parse_args()

    sources = sorted(SOURCE_DIR.glob("*.workflow.ts"))
    if not sources:
        print("No *.workflow.ts files found", file=sys.stderr)
        return 1

    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for source in sources:
            name = source.name.replace(".workflow.ts", ".json")
            committed_path = COMPILED_DIR / name
            fresh_path = Path(tmp) / name

            try:
                convert(source, fresh_path)
            except subprocess.CalledProcessError as exc:
                print(f"FAIL {source.name}: conversion failed")
                print((exc.stderr or exc.stdout or "").strip()[:500])
                failures += 1
                continue

            fresh = json.loads(fresh_path.read_text(encoding="utf-8"))

            if not committed_path.exists():
                print(f"FAIL {name}: no committed artifact in workflows/compiled/")
                failures += 1
                continue

            committed = json.loads(committed_path.read_text(encoding="utf-8"))
            drift = describe_drift(normalize(fresh), normalize(committed))

            if not drift:
                print(f"ok   {name}")
                continue

            if args.fix:
                committed_path.write_text(
                    json.dumps(fresh, indent=2) + "\n", encoding="utf-8"
                )
                print(f"fixed {name} ({len(drift)} difference(s) rewritten)")
                continue

            failures += 1
            print(f"FAIL {name}: compiled artifact is stale, {len(drift)} difference(s)")
            for line in drift[:10]:
                print(f"       {line}")
            if len(drift) > 10:
                print(f"       ... {len(drift) - 10} more")

    if failures:
        print(
            f"\n{failures} workflow(s) out of sync. Regenerate with:\n"
            f"    python3 scripts/check_compiled_drift.py --fix",
            file=sys.stderr,
        )
        return 1

    print(f"\nAll {len(sources)} compiled workflows match their TypeScript source.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
