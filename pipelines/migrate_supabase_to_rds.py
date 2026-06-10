"""
Migrate restaurant tables from Supabase to the EC2 shared RDS (PostgreSQL).

Source:  Supabase REST API (https://supabase.360ai.link)
Target:  RDS via SSM tunnel at localhost:15432, db=vforce

Tables migrated:
  public.info_gather_restaurants      → public.restaurant_info_gather
  public.info_gather_google_profiles  → public.restaurant_google_profiles

Prerequisites:
  1. vforce-db-tunnel service is running (systemctl status vforce-db-tunnel)
  2. SQL schema applied: psql ... -f sql/022_restaurant_tables_rds_migration.sql
  3. pip install --user psycopg2-binary requests

Usage:
  python3 pipelines/migrate_supabase_to_rds.py [--dry-run] [--table restaurants|profiles|all]
"""

import argparse
import json
import os
import sys
import time

import psycopg2
import psycopg2.extras
import requests

# ─── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://supabase.360ai.link")
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjI0MDUyMDAsImV4cCI6MTkyMDE3MTYwMH0."
    "0Scyjnrqt727pMYFEP5n-MBF3OcL2SyDUhgUTSLHLCE",
)

RDS_DSN = os.getenv(
    "RDS_DATABASE_URL",
    "postgresql://vforce_app:testapp123@localhost:15432/vforce?sslmode=require",
)

PAGE_SIZE = 200  # small pages to stay within memory


# ─── Supabase helpers ──────────────────────────────────────────────────────────

def supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    }


def count_rows(table: str) -> int:
    resp = requests.head(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**supabase_headers(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
        timeout=15,
    )
    cr = resp.headers.get("content-range", "*/0")
    return int(cr.split("/")[-1]) if "/" in cr else 0


def iter_pages(table: str):
    """Yield one page at a time; never holds more than PAGE_SIZE rows in memory."""
    offset = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={**supabase_headers(), "Range-Unit": "items",
                     "Range": f"{offset}-{offset + PAGE_SIZE - 1}"},
            params={"order": "created_at.asc"},
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        yield batch
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.05)


# ─── RDS helpers ───────────────────────────────────────────────────────────────

def connect_rds():
    return psycopg2.connect(RDS_DSN, connect_timeout=15)


def upsert_batch(cur, table: str, rows: list, pk: str = "id"):
    if not rows:
        return
    columns = list(rows[0].keys())
    col_list = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    update_set = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in columns if c != pk)
    sql = (
        f'INSERT INTO public."{table}" ({col_list}) VALUES ({placeholders}) '
        f'ON CONFLICT ("{pk}") DO UPDATE SET {update_set}'
    )
    data = [
        [json.dumps(v) if isinstance(v, (dict, list)) else v for v in [row.get(c) for c in columns]]
        for row in rows
    ]
    psycopg2.extras.execute_batch(cur, sql, data, page_size=100)


# ─── Migration tasks ───────────────────────────────────────────────────────────

def migrate_table(src_table: str, dst_table: str, dry_run: bool):
    total = count_rows(src_table)
    print(f"\n  {src_table} → {dst_table}  ({total:,} rows)")

    if dry_run:
        print("  [dry-run] skipping write.")
        return

    conn = connect_rds()
    conn.autocommit = False
    cur = conn.cursor()

    done = 0
    for page in iter_pages(src_table):
        upsert_batch(cur, dst_table, page)
        conn.commit()
        done += len(page)
        pct = done * 100 // max(total, 1)
        print(f"  {done:,}/{total:,} ({pct}%)", end="\r", flush=True)

    cur.close()
    conn.close()
    print(f"  {done:,}/{total:,} — done.        ")


# ─── Entry point ───────────────────────────────────────────────────────────────

TABLES = {
    "restaurants": ("info_gather_restaurants", "restaurant_info_gather"),
    "profiles":    ("info_gather_google_profiles", "restaurant_google_profiles"),
}


def run(dry_run: bool, table: str):
    print("=== Supabase → RDS migration ===")
    if dry_run:
        print("Mode: dry-run (read only)")
    else:
        print("Mode: LIVE — writing to RDS")
        try:
            conn = connect_rds()
            conn.close()
            print("RDS connection: OK")
        except Exception as e:
            print(f"RDS connection FAILED: {e}")
            print("Tip: run `systemctl status vforce-db-tunnel` and restart if needed.")
            sys.exit(1)

    tasks = [TABLES[table]] if table != "all" else list(TABLES.values())
    for src, dst in tasks:
        migrate_table(src, dst, dry_run)

    print("\nAll done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--table", choices=["restaurants", "profiles", "all"], default="all")
    args = parser.parse_args()
    run(dry_run=args.dry_run, table=args.table)
