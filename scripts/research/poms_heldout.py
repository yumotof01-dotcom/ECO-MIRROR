#!/usr/bin/env python3
"""ECO MIRROR: true 2023 held-out test using the official UK PoMS 1km FIT CSV.

Target: mean number of recorded insects per 10-minute count in a designated
1-km site and year. NOT abundance, ecosystem health, or local extinction.

Forecast issuance: end of 2022. 2023 survey outcomes never enter fit/tuning.
Source: UK PoMS (2026), DOI 10.5285/d706088c-9d48-4be5-b156-6ed6ad5e0618,
Open Government Licence. The output includes aggregate metrics only.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
import math
from pathlib import Path
import statistics
import sys
import zipfile

from poms_inspect import download_official, sniff_csv, DATA_ID

ARCHIVE_SHA256 = "b4b1901ef3257447e2e9eb0031b0cbbbc7f708edbad411811775f4401049668d"
SURVEY_CSV = "data/ukpoms_1kmfitcountdata_2017-2023.csv"
SURVEY_SHA256 = "29d3deb757c053774c26ece0a7683081a4b4fe81d9497877fe1179f232182e52"
FIRST_YEAR = 2017
TEST_YEAR = 2023
K_CANDIDATES = (0, 1, 2, 4, 8, 16)
TUNE_YEARS = (2020, 2021, 2022)
RISK_THRESHOLD = 0.70  # Arbitrary research endpoint, NOT a health threshold.


def mean(values):
    return sum(values) / len(values)


def summarize_errors(cases, name, baseline=None):
    if not cases:
        return {"status": "NO_MATCHING_SITES", "cases": 0}
    diffs = [case["predictions"][name] - case["observed"] for case in cases]
    mse = mean([d * d for d in diffs])
    result = {
        "sites": len(cases),
        "mae": round(mean([abs(d) for d in diffs]), 5),
        "rmse": round(math.sqrt(mse), 5),
        "bias": round(mean(diffs), 5),
    }
    if baseline is not None:
        base_mse = mean([
            (case["predictions"][baseline] - case["observed"]) ** 2 for case in cases
        ])
        result["squared_error_skill_vs_global"] = round(
            1 - mse / base_mse, 5
        ) if base_mse > 0 else None
    return result


def aggregate_sites(records):
    data = defaultdict(list)
    source_rows = 0
    discarded = Counter()
    samples = []
    for rec in records:
        source_rows += 1
        try:
            year = int(rec["year"])
            total = float(rec["all_insects_total"])
            location = rec["location_code"].strip()
            country = rec["country"].strip()
            if not country or not location or not math.isfinite(total) or total < 0:
                raise ValueError("invalid site or visit count")
            if abs(total - round(total)) > 1e-10:
                raise ValueError("non-integer count")
            if not FIRST_YEAR <= year <= TEST_YEAR:
                raise ValueError("outside study years")
        except (ValueError, KeyError, TypeError) as err:
            discarded[type(err).__name__] += 1
            continue
        site = (country, location)
        data[(site, year)].append(int(total))
        samples.append((site, year, int(total)))
    if not samples:
        raise ValueError("no valid official count records")
    means = {(site, year): mean(visits) for (site, year), visits in data.items()}
    counts = {(site, year): len(visits) for (site, year), visits in data.items()}
    return means, counts, source_rows, dict(discarded), samples


def historical_cases(means, prediction_year, k=0):
    """No current-year outcomes or covariates may enter a prediction."""
    country_means = defaultdict(list)
    for (site, year), avg in means.items():
        if year < prediction_year:
            country_means[site[0]].append(avg)
    global_avg = mean([v for x in country_means.values() for v in x])
    region_avg = {country: mean(vals) for country, vals in country_means.items()}
    available_sites = {site for site, year in means if year == prediction_year}
    cases = []
    for site in sorted(available_sites):
        history = sorted((year, val) for (s, year), val in means.items()
                         if s == site and year < prediction_year)
        site_avg = mean([x[1] for x in history]) if history else global_avg
        last = history[-1][1] if history else global_avg
        region = region_avg.get(site[0], global_avg)
        regional_shrunk = ((len(history) * site_avg + k * region) /
                            (len(history) + k)) if (len(history) + k) else region
        cases.append({
            "site": site,
            "observed": means[(site, prediction_year)],
            "history_years": len(history),
            "baseline_site_mean": site_avg if history else None,
            "predictions": {
                "global": global_avg,
                "country": region,
                "last_site": last,
                "site_mean": site_avg,
                "country_shrink": regional_shrunk,
            },
        })
    return cases


def tune_k(means):
    """Rolling origins in 2020–2022, never 2023."""
    scored = {}
    for k in K_CANDIDATES:
        old = [case for yr in TUNE_YEARS for case in historical_cases(means, yr, k)
               if case["history_years"] >= 1]
        scored[k] = mean([(c["predictions"]["country_shrink"]-c["observed"]) ** 2
                          for c in old]) if old else float("inf")
    chosen = min(K_CANDIDATES, key=lambda k: (scored[k], k))
    return chosen, {str(k): round(mse, 5) if math.isfinite(mse) else None
                    for k, mse in scored.items()}


def probabilistic_risk(means, k):
    """Experimental risk: 2023 site-year mean < 0.70 * prior site mean.

    Calibrate additive error distribution with rolling held-out origins from
    years 2020–2022. Do not interpret this as ecosystem-health probability.
    """
    old = [c for yy in TUNE_YEARS for c in historical_cases(means, yy, k)
           if c["history_years"] >= 2 and c["baseline_site_mean"] is not None
           and c["baseline_site_mean"] > 0]
    future = [c for c in historical_cases(means, TEST_YEAR, k)
              if c["history_years"] >= 2 and c["baseline_site_mean"] is not None
              and c["baseline_site_mean"] > 0]
    if len(old) < 30 or len(future) < 10:
        return {
            "status": "NOT_ESTIMABLE",
            "reason": "insufficient prior held-out predictions for calibration",
            "calibration_cases": len(old),
            "test_cases": len(future),
        }
    residuals = [c["observed"] - c["predictions"]["country_shrink"] for c in old]
    old_labels = [int(c["observed"] < RISK_THRESHOLD*c["baseline_site_mean"])
                  for c in old]
    p_climate = (1 + sum(old_labels)) / (len(old_labels) + 2)
    events, probs = [], []
    for c in future:
        cutoff = RISK_THRESHOLD*c["baseline_site_mean"] - c["predictions"]["country_shrink"]
        probability = (1 + sum(r < cutoff for r in residuals)) / (len(residuals) + 2)
        probs.append(probability)
        events.append(int(c["observed"] < RISK_THRESHOLD*c["baseline_site_mean"]))
    brier = mean([(p-y)**2 for p,y in zip(probs,events)])
    base_brier = mean([(p_climate-y)**2 for y in events])
    return {
        "status": "EXPERIMENTAL_NOT_ECOLOGICAL_HEALTH",
        "definition": "Mean count per 10 min is <70% of the same site's prior-year average",
        "threshold_is_arbitrary": True,
        "calibration_years": list(TUNE_YEARS),
        "test_year": TEST_YEAR,
        "calibration_cases": len(old),
        "test_cases": len(future),
        "observed_event_frequency": round(mean(events), 5),
        "mean_predicted_probability": round(mean(probs), 5),
        "prior_climatology_probability": round(p_climate, 5),
        "brier_country_shrink": round(brier, 6),
        "brier_prior_climatology": round(base_brier, 6),
        "brier_skill_vs_climatology": round(1-brier/base_brier, 5) if base_brier else None,
        "warning": "Only a retrospective, UK-specific, arbitrary count-drop target; not proof of ecological collapse.",
    }


def validate_synthetic():
    data = {
        (("GB", "A"), 2017): 2, (("GB", "A"), 2018): 4,
        (("GB", "B"), 2018): 6, (("GB", "A"), 2023): 5,
    }
    cs = historical_cases(data, 2023, k=2)
    assert len(cs) == 1 and cs[0]["history_years"] == 2
    assert cs[0]["observed"] == 5 and cs[0]["predictions"]["last_site"] == 4
    assert abs(cs[0]["predictions"]["country_shrink"] -
               (2*3+2*4)/4) < 1e-10
    assert not any(key[1] == 2023 for key in data if key[1] < 2023)
    assert len(historical_cases(data, 2018)) == 2
    print("PASS: synthetic time-split, shrinkage and zero-leakage fixtures")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="poms-heldout-2023.json")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        validate_synthetic()
        return
    raw, url, typ = download_official()
    archive_sha = hashlib.sha256(raw).hexdigest()
    if archive_sha != ARCHIVE_SHA256:
        raise ValueError("official archive changed: review the new version, do not silently re-fit")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        original = archive.read(SURVEY_CSV)
    if hashlib.sha256(original).hexdigest() != SURVEY_SHA256:
        raise ValueError("official FIT 1km CSV bytes mismatch")
    fields, records = sniff_csv(original)
    required = {"year", "country", "location_code", "all_insects_total"}
    if not required.issubset(set(fields)):
        raise ValueError("unexpected FIT count schema: " + repr(fields))
    means, counts, source_rows, excluded, samples = aggregate_sites(records)
    chosen_k, tuning = tune_k(means)
    target_cases = historical_cases(means, TEST_YEAR, chosen_k)
    repeat_cases = [c for c in target_cases if c["history_years"] > 0]
    methods = ("global", "country", "last_site", "site_mean", "country_shrink")
    metrics = {
        "all_2023_sites": {m: summarize_errors(target_cases, m, "global")
                           for m in methods},
        "previously_seen_sites": {m: summarize_errors(repeat_cases, m, "global")
                                  for m in methods},
    }
    report = {
        "data_source": "UK PoMS (2026), EIDC, OGL, 10.5285/" + DATA_ID,
        "archive_sha256": archive_sha,
        "source_csv_sha256": SURVEY_SHA256,
        "prediction_issue_year": 2022,
        "held_out_year": TEST_YEAR,
        "target": "site-year average recorded insect visits per 10-minute 1km FIT count",
        "units": "visits per 10-minute count, site-year average",
        "method": "hold out 2023 entire year; tune shrinkage using rolling 2020-2022",
        "data_audit": {
            "source_csv_records": source_rows,
            "included_surveys": len(samples),
            "invalid_surveys": excluded,
            "year_survey_counts": {str(yr): sum(syear == yr for _,syear,_ in samples)
                                   for yr in range(FIRST_YEAR, TEST_YEAR+1)},
            "year_site_counts": {str(yr): sum(y == yr for (_,y) in means)
                                 for yr in range(FIRST_YEAR, TEST_YEAR+1)},
            "zero_visitor_counts": sum(n == 0 for _,_,n in samples),
            "heldout_site_count": len(target_cases),
            "heldout_sites_with_previous_year_history": len(repeat_cases),
        },
        "hyperparameter_training_only": {
            "candidate_k": list(K_CANDIDATES),
            "rolling_origin_years": list(TUNE_YEARS),
            "chosen_k": chosen_k,
            "rolling_mean_squared_error_by_k": tuning,
        },
        "metrics": metrics,
        "risk_experiment": probabilistic_risk(means, chosen_k),
        "scientific_limitations": [
            "Number of records is not insect population size or ecosystem health",
            "Year-specific weather and plant composition are not adjusted in these baselines",
            "Only survey sites in the official 1km monitoring network, not random world locations",
            "Changing mix of sampled survey days can affect year-to-year site averages",
            "No target-year observations were used to tune model parameters",
            "Risk event's 30% count decline is arbitrary and not scientifically validated degradation",
            "No forecasts for Japan or other ecosystems are justified by this test",
        ],
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2)[:20000])


if __name__ == "__main__":
    main()
