#!/usr/bin/env python3
"""Inspect the official UK PoMS EIDC 2017-2023 distribution.

Only EIDC original bytes are used. No user observation data is requested.
Outputs aggregate/schema metadata only; raw data and coordinates are not published.
Run: python scripts/research/poms_inspect.py --out poms-inspection.json
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import io
import json
import pathlib
import sys
import urllib.error
import urllib.request
import zipfile

DATA_ID = "d706088c-9d48-4be5-b156-6ed6ad5e0618"
SOURCE = f"https://data-package.ceh.ac.uk/data/{DATA_ID}"
MAX_BYTES = 95 * 1024 * 1024
MAX_FILE_BYTES = 80 * 1024 * 1024


def download_official() -> tuple[bytes, str, str]:
    candidates = (SOURCE, SOURCE + ".zip")
    failures = []
    for url in candidates:
        try:
            request = urllib.request.Request(url, headers={
                "User-Agent": "ECO-MIRROR-research/0.1 (open-data; source attribution)",
                "Accept": "application/zip,text/csv,application/octet-stream,*/*",
            })
            with urllib.request.urlopen(request, timeout=75) as response:
                final_url = response.geturl()
                if not final_url.startswith(("https://data-package.ceh.ac.uk/", "https://catalogue.ceh.ac.uk/")):
                    raise ValueError("unexpected redirect host: " + final_url[:110])
                raw = response.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError("download larger than safe byte cap")
                content_type = response.headers.get("Content-Type", "")
            if not (zipfile.is_zipfile(io.BytesIO(raw)) or raw.lstrip().startswith((b"Year,", b"year,", b"survey,"))):
                raise ValueError("response not recognized as ZIP or CSV; type=" + content_type + "; bytes=" + str(len(raw)))
            return raw, final_url, content_type
        except Exception as exc:
            failures.append(type(exc).__name__ + ": " + str(exc)[:230])
    raise RuntimeError("official EIDC download not accessible; " + " | ".join(failures))


def sniff_csv(data: bytes) -> tuple[list[str], list[dict[str, str]]]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252")
    head = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(head, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text, newline=""), dialect=dialect)
    fields = reader.fieldnames or []
    if not fields or any(field is None or not field.strip() for field in fields):
        raise ValueError("invalid CSV header")
    rows = list(reader)
    if any(None in row for row in rows):
        raise ValueError("malformed CSV row")
    return fields, rows


def summarize_csv(name: str, data: bytes) -> dict:
    columns, rows = sniff_csv(data)
    year_fields = [col for col in columns if col.lower().replace("_", "").replace(" ", "") in
                   ("year", "surveyyear", "countyear", "collectionyear", "recordyear")]
    if not year_fields:
        year_fields = [col for col in columns if "year" in col.lower()]
    year_summary = {}
    for year_col in year_fields[:3]:
        freq = collections.Counter(row.get(year_col, "") for row in rows)
        year_summary[year_col] = dict(sorted(freq.items())[:30])
    return {
        "name": name,
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "records": len(rows),
        "column_names": columns,
        "possible_year_fields": year_summary,
        "blank_by_column": {
            col: sum(row.get(col, "") in ("", None) for row in rows)
            for col in columns
        },
    }


def inspect(raw: bytes, final_url: str, content_type: str) -> dict:
    files = []
    is_zip = zipfile.is_zipfile(io.BytesIO(raw))
    if is_zip:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            members = [x for x in z.infolist() if not x.is_dir()]
            if sum(x.file_size for x in members) > MAX_FILE_BYTES * 4:
                raise ValueError("expanded dataset exceeds safe cap")
            for m in members:
                if not m.filename.lower().endswith(".csv"):
                    continue
                if m.file_size > MAX_FILE_BYTES:
                    files.append({"name": m.filename, "error": "CSV larger than per-file cap"})
                    continue
                try:
                    files.append(summarize_csv(m.filename, z.read(m)))
                except (ValueError, UnicodeError, csv.Error) as e:
                    files.append({"name": m.filename, "error": str(e)})
            names = [x.filename for x in members]
    else:
        names = ["download.csv"]
        files = [summarize_csv("download.csv", raw)]
    return {
        "dataset_doi": "10.5285/" + DATA_ID,
        "source": "UK Pollinator Monitoring Scheme (2026), EIDC. Open Government Licence.",
        "source_uri": SOURCE,
        "download_final_uri": final_url,
        "download_content_type": content_type,
        "archive_sha256": hashlib.sha256(raw).hexdigest(),
        "archive_bytes": len(raw),
        "archive_members": names,
        "csv_files": files,
        "contains_raw_coordinates": "Raw coordinates may exist in source; output contains headers and aggregate counts only.",
        "future_validation_status": "NO MODEL FIT: this file is only a schema and sampling audit.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="poms-inspection.json")
    a = parser.parse_args()
    try:
        raw, final_url, kind = download_official()
        report = inspect(raw, final_url, kind)
        status = 0
    except Exception as exc:
        report = {
            "dataset_doi": "10.5285/" + DATA_ID,
            "status": "DATA_ACCESS_FAILED",
            "error": str(exc),
            "future_validation_status": "NOT RUN",
        }
        status = 1
    pathlib.Path(a.out).write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2)[:16000])
    return status


if __name__ == "__main__":
    sys.exit(main())
