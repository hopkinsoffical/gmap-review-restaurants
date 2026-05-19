#!/usr/bin/env python3
"""
Map phone lookup fields (valid, line_type) to SMS reachability labels in Chinese.

Input CSV: include at least `phone`, and columns `valid` + `line_type` from your
lookup provider (e.g. Twilio Line Type Intelligence). Missing valid/line_type
yields 需要测试短信确认.

  python3 scripts/phone_sms_reachability.py -i data/phones.csv -o data/phones_sms.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Any


def parse_boolish(raw: Any) -> bool | None:
    s = str(raw or "").strip().lower()
    if s in ("", "null", "none", "n/a", "na"):
        return None
    if s in ("1", "true", "t", "yes", "y", "valid"):
        return True
    if s in ("0", "false", "f", "no", "n", "invalid"):
        return False
    return None


def sms_reachability(valid: bool | None, line_type: str | None) -> str:
    """
    批量/单条：根据 valid 与 line_type 判断短信可达性（中文标签）。

    - valid is False  -> 不可用
    - valid is True, line_type in mobile, wireless -> 高概率可收短信
    - valid is True, line_type == voip -> 可能可收短信，但不稳定
    - valid is True, line_type == landline -> 通常不可收短信
    - else -> 需要测试短信确认
    """
    if valid is False:
        return "不可用"
    if valid is not True:
        return "需要测试短信确认"

    lt = (line_type or "").strip().lower()
    if lt in ("mobile", "wireless"):
        return "高概率可收短信"
    if lt == "voip":
        return "可能可收短信，但不稳定"
    if lt == "landline":
        return "通常不可收短信"
    return "需要测试短信确认"


def _row_sms_label(row: dict[str, str], valid_key: str, line_type_key: str) -> str:
    v = parse_boolish(row.get(valid_key))
    lt = str(row.get(line_type_key) or "").strip() or None
    return sms_reachability(v, lt)


def cmd_batch(args: argparse.Namespace) -> int:
    in_path = Path(args.input)
    if not in_path.is_file():
        print(f"Missing input: {in_path}", file=sys.stderr)
        return 1

    valid_col = str(args.valid_column)
    lt_col = str(args.line_type_column)
    out_col = str(args.output_column)

    with in_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header = list(reader.fieldnames or [])
        if not header:
            print("Empty CSV", file=sys.stderr)
            return 1
        for req in (valid_col, lt_col):
            if req not in header:
                print(f"Column `{req}` not in CSV. Available: {header}", file=sys.stderr)
                return 1
        rows = list(reader)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else header
    if out_col not in fieldnames:
        fieldnames = fieldnames + [out_col]

    with out_path.open("w", newline="", encoding="utf-8") as w:
        writer = csv.DictWriter(w, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            out = dict(row)
            out[out_col] = _row_sms_label(row, valid_col, lt_col)
            writer.writerow(out)

    print(f"Wrote {len(rows)} rows to {out_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Label SMS reachability from valid + line_type")
    p.add_argument("-i", "--input", required=True, help="Input CSV (must include valid + line_type columns)")
    p.add_argument("-o", "--output", required=True, help="Output CSV (same columns + label column)")
    p.add_argument(
        "--valid-column",
        default="valid",
        help="Column name for boolean valid (default: valid)",
    )
    p.add_argument(
        "--line-type-column",
        default="line_type",
        help="Column name for line type (default: line_type)",
    )
    p.add_argument(
        "--output-column",
        default="sms_reachability",
        help="Column name for the Chinese label (default: sms_reachability)",
    )
    p.set_defaults(func=cmd_batch)
    args = p.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
