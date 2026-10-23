#!/usr/bin/env python3
"""Read-only audit of two pinned source CSVs; no import or simulation engine.

Uses Python's standard library. Writes only derived documentation to --output-dir.
Never edits, deduplicates, repairs, or executes the upstream research files.
"""

import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


GITHUB_SHA256 = "c7d2b988b6d8cb356351f3cf971ce297e9d531d81897e0ce368ba4629c84fd06"
ARCHIVE_SHA256 = "c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a"
COLUMNS = ["Year", "Plot", "Round", "Plant", "Specimen_ID", "Basic_Type", "Treatment"]
MISSING_MARKERS = {"", "na", "n/a", "null", "(null)", "nan", "none"}
COMBINED_LABELS = {
    "Bellardia_vulgaris_viarum",
    "Bombus_terrestris_lucorum",
    "Syrphus_vitripennis_rectus",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_csv(path, expected_hash):
    raw = path.read_bytes()
    if digest(raw) != expected_hash:
        raise ValueError(f"Unexpected SHA-256 for {path.name}; do not reuse this audit for a different snapshot")
    table = list(csv.reader(io.StringIO(raw.decode("utf-8"), newline=""), strict=True))
    if not table or table[0] != COLUMNS:
        raise ValueError("Unexpected CSV header")
    if any(len(row) != len(COLUMNS) for row in table[1:]):
        raise ValueError("Empty or malformed CSV records found")
    return raw, table, [dict(zip(COLUMNS, row)) for row in table[1:]]


def grouped(rows, keys):
    counts = Counter(tuple(row[key] for key in keys) for row in rows)
    return [{**dict(zip(keys, key)), "record_count": count} for key, count in sorted(counts.items())]


def inventory(rows, column):
    result = []
    for label in sorted({row[column] for row in rows}):
        subset = [row for row in rows if row[column] == label]
        flags = []
        if label.endswith("_sp"):
            flags.append("unresolved_sp_label")
        if label in COMBINED_LABELS:
            flags.append("combined_label_requires_review")
        if label.endswith("_sl"):
            flags.append("broad_sense_label_requires_review")
        result.append({
            "raw_label": label,
            "record_count": len(subset),
            "year_2014": sum(row["Year"] == 2014 for row in subset),
            "year_2015": sum(row["Year"] == 2015 for row in subset),
            "basic_types": sorted({row["Basic_Type"] for row in subset}) if column == "Specimen_ID" else [],
            "label_flags": flags,
        })
    return result


def markdown_table(headers, records):
    return "\n".join([
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
        *("| " + " | ".join(str(value) for value in row) + " |" for row in records),
    ])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--github-csv", type=Path, required=True)
    parser.add_argument("--archive-csv", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    github_raw, github_table, raw_rows = load_csv(args.github_csv, GITHUB_SHA256)
    archive_raw, archive_table, _ = load_csv(args.archive_csv, ARCHIVE_SHA256)
    if github_table != archive_table:
        raise ValueError("The GitHub and university archive parsed records differ")
    if github_raw != archive_raw.replace(b"\r\n", b"\n"):
        raise ValueError("Differences extend beyond CRLF versus LF")

    column_profile = []
    for column in COLUMNS:
        values = [row[column] for row in raw_rows]
        column_profile.append({
            "name": column,
            "type": "integer" if column in {"Year", "Plot", "Round"} else "string",
            "distinct_count": len(set(values)),
            "empty_cell_count": sum(value.strip() == "" for value in values),
            "missing_marker_count": sum(value.strip().lower() in MISSING_MARKERS for value in values),
            "outer_whitespace_count": sum(value != value.strip() for value in values),
        })

    rows = []
    for raw_row in raw_rows:
        row = dict(raw_row)
        for column in ["Year", "Plot", "Round"]:
            if not re.fullmatch(r"[0-9]+", row[column]):
                raise ValueError(f"Invalid integer in {column}")
            row[column] = int(row[column])
        rows.append(row)
    if len(rows) != 3882:
        raise ValueError("Unexpected record count")

    exact_counts = Counter(tuple(row[column] for column in COLUMNS) for row in raw_rows)
    plot_treatments = defaultdict(set)
    visitor_types = defaultdict(set)
    for row in rows:
        plot_treatments[(row["Year"], row["Plot"])].add(row["Treatment"])
        visitor_types[row["Specimen_ID"]].add(row["Basic_Type"])
    plot_conflicts = [list(key) for key, value in sorted(plot_treatments.items()) if len(value) != 1]
    type_conflicts = {key: sorted(value) for key, value in sorted(visitor_types.items()) if len(value) != 1}
    years = sorted({row["Year"] for row in rows})
    plots = sorted({row["Plot"] for row in rows})
    rounds_by_year = {year: sorted({row["Round"] for row in rows if row["Year"] == year}) for year in years}
    cells = Counter((row["Year"], row["Plot"], row["Round"]) for row in rows)
    absent_cells = [
        {"Year": year, "Plot": plot, "Round": round_label, "status": "no_record_effort_unknown"}
        for year in years for plot in plots for round_label in rounds_by_year[year]
        if (year, plot, round_label) not in cells
    ]
    year_summary = []
    for year in years:
        subset = [row for row in rows if row["Year"] == year]
        year_summary.append({
            "Year": year,
            "record_count": len(subset),
            "plant_label_count": len({row["Plant"] for row in subset}),
            "visitor_label_count": len({row["Specimen_ID"] for row in subset}),
            "observed_pair_count": len({(row["Plant"], row["Specimen_ID"]) for row in subset}),
            "plot_count": len({row["Plot"] for row in subset}),
            "round_labels": rounds_by_year[year],
            "plot_round_cells_with_records": len({(row["Plot"], row["Round"]) for row in subset}),
        })

    profile = {
        "audit_version": "1.0.0",
        "provenance_manifest": "manifest.json",
        "attribution": {
            "creators": ["Ellen Moss", "Darren Evans"],
            "dataset_doi": "10.25405/data.ncl.17430548.v1",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "changes": "Audit counts and label flags derived from the original records; no row deletion or taxonomic merging.",
        },
        "input": {
            "github": {"sha256": digest(github_raw), "bytes": len(github_raw), "crlf_count": github_raw.count(b"\r\n"), "lf_count": github_raw.count(b"\n"), "utf8_bom": github_raw.startswith(b"\xef\xbb\xbf")},
            "university_archive": {"sha256": digest(archive_raw), "md5": hashlib.md5(archive_raw).hexdigest(), "bytes": len(archive_raw), "crlf_count": archive_raw.count(b"\r\n"), "lf_count": archive_raw.count(b"\n")},
            "all_bytes_ascii": github_raw.isascii(),
            "parsed_tables_identical": github_table == archive_table,
            "identical_after_archive_crlf_to_lf": github_raw == archive_raw.replace(b"\r\n", b"\n"),
        },
        "record_count": len(rows),
        "columns": column_profile,
        "exact_row_repeats": {
            "unique_seven_column_rows": len(exact_counts),
            "repeated_groups": sum(count > 1 for count in exact_counts.values()),
            "rows_in_repeated_groups": sum(count for count in exact_counts.values() if count > 1),
            "excess_if_deduplicated": len(rows) - len(exact_counts),
            "maximum_multiplicity": max(exact_counts.values()),
            "policy": "retain_all_rows",
        },
        "plant_label_count": len({row["Plant"] for row in rows}),
        "visitor_label_count": len(visitor_types),
        "observed_pair_count": len({(row["Plant"], row["Specimen_ID"]) for row in rows}),
        "basic_type_conflicts": type_conflicts,
        "year_plot_treatment_conflicts": plot_conflicts,
        "treatment_changes_between_years": [plot for plot in plots if len(set().union(*(plot_treatments[(year, plot)] for year in years))) > 1],
        "year_summary": year_summary,
        "year_treatment_counts": grouped(rows, ["Year", "Treatment"]),
        "year_plot_counts": grouped(rows, ["Year", "Plot", "Treatment"]),
        "year_round_counts": grouped(rows, ["Year", "Round"]),
        "year_plot_round_counts": grouped(rows, ["Year", "Plot", "Round"]),
        "plot_round_cells_without_records": absent_cells,
        "basic_type_counts": grouped(rows, ["Basic_Type"]),
        "plant_inventory": inventory(rows, "Plant"),
        "visitor_inventory": inventory(rows, "Specimen_ID"),
    }
    for collection in ["year_summary", "year_treatment_counts", "year_plot_counts", "year_round_counts", "year_plot_round_counts", "basic_type_counts", "plant_inventory", "visitor_inventory"]:
        if sum(item["record_count"] for item in profile[collection]) != len(rows):
            raise ValueError(f"Record counts do not reconcile: {collection}")

    counts_doc = [
        "# 年・区画・調査回別の記録数", "",
        "`audit.py` が固定ハッシュの実CSVから生成した監査集計。アプリのシミュレーション結果ではない。原綴りの分類名を使い、行を削除していない。", "",
        "## 年別", "",
        markdown_table(["年", "行数", "植物ラベル", "昆虫ラベル", "観測ペア", "記録のある区画×回"], [[item["Year"], item["record_count"], item["plant_label_count"], item["visitor_label_count"], item["observed_pair_count"], item["plot_round_cells_with_records"]] for item in year_summary]), "",
        f"総行数は{len(rows):,}。全期間を合わせた観測ペアは{profile['observed_pair_count']}。年ごとのペアには重なりがあるため、年別ペア数の和を全体のペア数としない。ラベル数は検証済みの生物学的種数ではない。", "",
        "## 年・処理別", "",
        markdown_table(["年", "Treatment", "行数"], [[item["Year"], item["Treatment"], item["record_count"]] for item in profile["year_treatment_counts"]]), "",
        "## 区画別", "",
        markdown_table(["Plot", "Treatment（両年一致）", "2014", "2015", "合計"], [[plot, next(iter(plot_treatments[(2014, plot)])), sum(row["Year"] == 2014 and row["Plot"] == plot for row in rows), sum(row["Year"] == 2015 and row["Plot"] == plot for row in rows), sum(row["Plot"] == plot for row in rows)] for plot in plots]), "",
        "## 年・調査回別", "",
        markdown_table(["年", "Round（元ラベル）", "行数"], [[item["Year"], item["Round"], item["record_count"]] for item in profile["year_round_counts"]]), "",
        "2014年のラベルは1・3・4・5・7・8・9、2015年は1〜7。各年7種類だが、2014年の2・6を欠損回と断定せず、勝手に1〜7へ振り直さない。実施日との対応表は未確認。", "",
        "## 年・区画・調査回別", "",
        "「—」はCSVに行がない組合せ。訪花0件を実地確認した意味ではなく、調査実施・努力量はこのファイルから確認できない。数値欄のみが観測記録の件数。", "",
    ]
    for year in years:
        round_labels = rounds_by_year[year]
        counts_doc += [f"### {year}年", "", markdown_table(["Plot"] + [f"回{label}" for label in round_labels] + ["合計"], [[plot] + [cells.get((year, plot, label), "—") for label in round_labels] + [sum(cells.get((year, plot, label), 0) for label in round_labels)] for plot in plots]), ""]
    counts_doc += [
        f"年別の実在Roundラベル×24区画で作る336組のうち、記録ありは{len(cells)}組、行なしは{len(absent_cells)}組。行なしを欠測値0として元データへ追加しない。", "",
        markdown_table(["年", "Plot", "Round", "状態"], [[item["Year"], item["Plot"], item["Round"], "記録なし・実施不明"] for item in absent_cells]), "",
        "## Basic_Type別", "",
        markdown_table(["Basic_Type（元ラベル）", "行数"], [[item["Basic_Type"], item["record_count"]] for item in profile["basic_type_counts"]]), "",
        "出典：Ellen Moss and Darren Evans (2022), [Climate change impacts on plant-pollinator interactions and functioning - experiment data, v1](https://doi.org/10.25405/data.ncl.17430548.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。変更内容：行の削除・学名統合をせず、監査集計表へ変換。対象ハッシュ等はmanifest.json、全表の機械可読版はprofile.jsonを参照。", "",
    ]
    taxa_doc = ["# 原綴りの分類ラベル一覧", "", "自動名寄せ・学名修正を行う前の一覧。`_sp`、複合名、`_sl`はラベル上の注意フラグで、標本の再同定結果ではない。すべての学名を分類データベースで確認済みと解釈しない。", ""]
    for title, collection in [("植物（Plant）", "plant_inventory"), ("昆虫（Specimen_ID）", "visitor_inventory")]:
        taxa_doc += [f"## {title}", "", markdown_table(["元ラベル", "2014", "2015", "計", "Basic_Type", "ラベル上の注意"], [[item["raw_label"], item["year_2014"], item["year_2015"], item["record_count"], ", ".join(item["basic_types"]) or "—", ", ".join(item["label_flags"]) or "—"] for item in profile[collection]]), ""]
    taxa_doc += ["学名の異名・綴り・同定粒度の評価はREADME.mdの分類名の節を参照。", "", "出典：Ellen Moss and Darren Evans (2022), [Climate change impacts on plant-pollinator interactions and functioning - experiment data, v1](https://doi.org/10.25405/data.ncl.17430548.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。変更内容：元ラベルの年別件数と注意フラグを付した一覧へ変換。学名の修正・統合は未実施。取得元・ハッシュはmanifest.jsonを参照。", ""]
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "counts.md").write_text("\n".join(counts_doc), encoding="utf-8")
    (args.output_dir / "taxa.md").write_text("\n".join(taxa_doc), encoding="utf-8")
    print(json.dumps({"record_count": len(rows), "observed_pairs": profile["observed_pair_count"], "cells_with_records": len(cells), "cells_without_records": len(absent_cells), "parsed_tables_identical": True, "output_files": ["profile.json", "counts.md", "taxa.md"]}))


if __name__ == "__main__":
    main()
