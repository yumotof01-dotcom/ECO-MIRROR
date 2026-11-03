#!/usr/bin/env python3
"""Independent descriptive audit of ECO MIRROR's fixed UK flower-visit CSV.

This CLI estimates only expected *observed-pair detection* under a uniform,
fixed-size, without-replacement sample of the recorded events. It does not
estimate field detection probability or predict future ecosystem damage.

Usage:
    python scripts/research/future_risk_audit.py --self-test
    python scripts/research/future_risk_audit.py --check
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2] / (
    "data/raw/moss-evans-2022-flower-visits-v1/Raw_InteractionData_BothYears.csv"
)
SOURCE_SHA256 = "c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a"
HEADERS = (
    "Year", "Plot", "Round", "Plant", "Specimen_ID", "Basic_Type", "Treatment"
)
PERCENTAGES = (5, 10, 20, 30, 50, 75, 100)


def expected_pair_count(pair_frequencies: Counter[tuple[str, str]], sample_size: int) -> float:
    """Expected unique observed pairs, conditioned on the finite recorded CSV.

    Pair occurring c times is missed with probability C(N-c,n)/C(N,n).
    Evaluate it as product over c factors to avoid enormous binomial integers.
    """
    population = sum(pair_frequencies.values())
    if not 0 <= sample_size <= population:
        raise ValueError("sample_size outside 0..N")
    if population == 0:
        return 0.0
    estimate = 0.0
    for frequency in pair_frequencies.values():
        if frequency > population - sample_size:
            unseen = 0.0
        else:
            unseen = 1.0
            for j in range(frequency):
                unseen *= (population - sample_size - j) / (population - j)
        estimate += 1.0 - unseen
    return estimate


def audit(rows: list[dict[str, str]]) -> dict:
    n = len(rows)
    pairs = Counter((r["Plant"], r["Specimen_ID"]) for r in rows)
    fingerprints = Counter(tuple(r[k] for k in HEADERS) for r in rows)
    years = sorted({r["Year"] for r in rows})
    per_year = {}
    pair_sets = {}
    for year in years:
        subset = [r for r in rows if r["Year"] == year]
        ps = {(r["Plant"], r["Specimen_ID"]) for r in subset}
        pair_sets[year] = ps
        per_year[year] = {
            "events": len(subset), "observed_pairs": len(ps),
            "plant_labels": len({r["Plant"] for r in subset}),
            "insect_labels": len({r["Specimen_ID"] for r in subset}),
        }
    missing_groups = []
    for year in years:
        subset = [r for r in rows if r["Year"] == year]
        rounds = sorted({int(r["Round"]) for r in subset})
        plots = sorted({int(r["Plot"]) for r in subset})
        present = {(int(r["Plot"]), int(r["Round"])) for r in subset}
        for plot in plots:
            for round_id in rounds:
                if (plot, round_id) not in present:
                    missing_groups.append({"year": year, "plot": plot, "round": round_id,
                                           "status": "no_record_effort_unknown"})
    expected = {}
    for percent in PERCENTAGES:
        # Integer half-up rounding; the existing scientific sampling rule.
        draw = (n * percent + 50) // 100
        count = expected_pair_count(pairs, draw)
        expected[str(percent)] = {
            "sampled_events": draw,
            "expected_detected_pairs": round(count, 6),
            "expected_pair_retention_percent": round(100 * count / len(pairs), 6)
            if pairs else None,
        }
    overlap = None
    if years == ["2014", "2015"]:
        a, b = pair_sets["2014"], pair_sets["2015"]
        overlap = {
            "shared_pairs": len(a & b),
            "only_2014": len(a - b), "only_2015": len(b - a),
            "jaccard": round(len(a & b) / len(a | b), 6) if a | b else None,
        }
    return {
        "interpretation": "finite recorded event sample; NOT ecosystem future prediction",
        "events": n,
        "observed_pairs": len(pairs),
        "singleton_pairs": sum(c == 1 for c in pairs.values()),
        "doubleton_pairs": sum(c == 2 for c in pairs.values()),
        "pairs_recorded_at_most_3_times": sum(c <= 3 for c in pairs.values()),
        "unique_seven_field_patterns": len(fingerprints),
        "per_year": per_year,
        "year_overlap": overlap,
        "no_record_effort_unknown_groups": missing_groups,
        "expected_under_event_sampling": expected,
    }


def load_fixed_source(path: Path) -> list[dict[str, str]]:
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != SOURCE_SHA256:
        raise ValueError("source SHA-256 mismatch: refusing unverified input")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8"), newline=""))
    if tuple(reader.fieldnames or ()) != HEADERS:
        raise ValueError("unexpected source column names or order")
    rows = list(reader)
    if any(None in r or any(r[k] is None for k in HEADERS) for r in rows):
        raise ValueError("malformed CSV record")
    return rows


def self_test() -> None:
    example = Counter({("A", "X"): 2, ("B", "Y"): 1, ("C", "Z"): 1})
    assert expected_pair_count(example, 0) == 0
    assert expected_pair_count(example, 4) == 3
    assert abs(expected_pair_count(example, 2) - (11 / 6)) < 1e-12
    assert (3882 * 30 + 50) // 100 == 1165
    try:
        expected_pair_count(example, 5)
    except ValueError:
        pass
    else:
        raise AssertionError("out of bounds must be rejected")
    print("Self-test passed: exact hypergeometric example and boundaries")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", action="store_true",
                        help="raise on deviation from source-confirmed invariants")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    result = audit(load_fixed_source(SOURCE))
    if args.check:
        assert result["events"] == 3882
        assert result["observed_pairs"] == 257
        assert result["singleton_pairs"] == 118
        assert result["doubleton_pairs"] == 43
        assert result["pairs_recorded_at_most_3_times"] == 181
        assert result["unique_seven_field_patterns"] == 1952
        assert result["year_overlap"]["shared_pairs"] == 62
        assert len(result["no_record_effort_unknown_groups"]) == 15
        assert abs(result["expected_under_event_sampling"]["30"]["expected_detected_pairs"]
                   - 141.774526) < 1e-5
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
