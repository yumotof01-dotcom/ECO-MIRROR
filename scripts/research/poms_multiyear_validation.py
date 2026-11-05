#!/usr/bin/env python3
"""Repeated real-data ecological *visit-count* hindcasts for ECO MIRROR.

Official UK PoMS 1km FIT counts (2017-2023), OGL, EIDC DOI:
https://doi.org/10.5285/d706088c-9d48-4be5-b156-6ed6ad5e0618

Forecast a site-year mean 10-minute *recorded visitation count*, not biological
abundance, ecosystem health, or a biological collapse probability.

For every test year all training, site habitat, hyperparameter selection, and
calibration use only years before that year. Extra user surveys are NOT needed.
No individual locations/IDs are emitted in aggregate results.
"""
from __future__ import annotations

import argparse
from collections import defaultdict, Counter
from hashlib import sha256
import io
import json
import math
from pathlib import Path
import random
import zipfile

from poms_inspect import download_official, sniff_csv
from poms_heldout import SURVEY_CSV, SURVEY_SHA256, mean, aggregate_sites

K_GRID = (0, 1, 2, 4, 8, 16, 32)
REPORT_YEARS = (2020, 2021, 2022, 2023)
TRIALS = 2000
SEED = 271828
REQUIRED_FIELDS = {"year", "country", "location_code", "all_insects_total", "habitat_type"}


def load_official():
    raw, _, _ = download_official()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        original = z.read(SURVEY_CSV)
    if sha256(original).hexdigest() != SURVEY_SHA256:
        raise ValueError("official research CSV hash has changed; manual provenance review required")
    cols, records = sniff_csv(original)
    if not REQUIRED_FIELDS.issubset(cols):
        raise ValueError("official CSV missing a required research column")
    means, counts, count, rejects, samples = aggregate_sites(records)
    habitats = defaultdict(Counter)
    for r in records:
        try:
            year = int(r["year"])
            if not 2017 <= year <= 2023: continue
            site = (r["country"].strip(), r["location_code"].strip())
            name = (r["habitat_type"] or "").strip()
            if site[0] and site[1] and name:
                habitats[(site, year)][name] += 1
        except (ValueError, TypeError, KeyError):
            pass
    return means, habitats, {"records": count, "valid": len(samples),
                             "rejected": rejects, "explicit_zero_visits": sum(v == 0 for _, _, v in samples)}


def historical_facts(means, habitats, prediction_year, exclude_sites=frozenset()):
    """Build features only from records earlier than the predicted year."""
    history = defaultdict(list)
    for (site, year), value in means.items():
        if year < prediction_year and site not in exclude_sites:
            history[site].append((year, value))
    for values in history.values():
        values.sort()
    flat = [val for values in history.values() for _, val in values]
    if not flat:
        raise ValueError("no training data")
    global_prior = mean(flat)
    country = defaultdict(list)
    for site, years in history.items():
        country[site[0]].extend(v for _, v in years)
    country_prior = {c: mean(arr) for c, arr in country.items()}

    site_hab = {}
    for site in history:
        votes = Counter()
        for (s, yr), c in habitats.items():
            if s == site and yr < prediction_year:
                votes.update(c)
        if votes:
            # deterministic tie-break; past-only
            site_hab[site] = sorted(votes, key=lambda key: (-votes[key], key))[0]
    habitat_values = defaultdict(list)
    for site, years in history.items():
        hab = site_hab.get(site)
        if hab:
            habitat_values[(site[0], hab)].extend(v for _, v in years)
    # Shrink habitat-specific means toward national means to reduce overfit.
    habitat_prior = {
        key: (len(vals) * mean(vals) + 12 * country_prior.get(key[0], global_prior)) /
             (len(vals) + 12)
        for key, vals in habitat_values.items()
    }
    # Trend based on the same sites in the last two completed years only.
    country_deltas = defaultdict(list)
    for site, years in history.items():
        d = dict(years)
        if prediction_year - 1 in d and prediction_year - 2 in d:
            country_deltas[site[0]].append(d[prediction_year - 1] - d[prediction_year - 2])
    country_trend = {}
    for c, arr in country_deltas.items():
        if len(arr) >= 5:
            # Shrink trend based on paired sites; cap relative to country visit average.
            proposed = mean(arr) * len(arr) / (len(arr) + 20)
            cap = 0.3 * country_prior.get(c, global_prior)
            country_trend[c] = max(-cap, min(cap, proposed))
    return {
        "history": history, "global": global_prior,
        "country": country_prior, "habitat": habitat_prior,
        "site_habitat": site_hab, "trend": country_trend,
    }


def predictions(facts, site, k=8):
    hist = facts["history"].get(site, [])
    own = mean([v for _, v in hist]) if hist else None
    nation = facts["country"].get(site[0], facts["global"])
    local_hab = facts["site_habitat"].get(site)
    hab = facts["habitat"].get((site[0], local_hab), nation) if local_hab else nation
    n = len(hist)
    shrink = (n * own + k * nation) / (n + k) if n and n + k > 0 else nation
    habitat_shrink = (n * own + k * hab) / (n + k) if n and n + k > 0 else nation
    trend = facts["trend"].get(site[0], 0.0)
    return {
        "global": facts["global"],
        "country": nation,
        "last_site": hist[-1][1] if hist else nation,
        "site_mean": own if own is not None else nation,
        "country_shrink": shrink,
        "habitat_shrink": habitat_shrink,
        "country_trend_shrink": max(0.0, shrink + trend),
    }


MODELS = ("global", "country", "last_site", "site_mean",
          "country_shrink", "habitat_shrink", "country_trend_shrink")


def test_cases(means, habitats, year, k, exclude_sites=frozenset(), only_sites=None):
    facts = historical_facts(means, habitats, year, exclude_sites=exclude_sites)
    return [
        {"site": site, "observation": value,
         "previous_years": len(facts["history"].get(site, [])),
         "pred": predictions(facts, site, k)}
        for (site, y), value in sorted(means.items())
        if y == year and (only_sites is None or site in only_sites)
    ]


def squared_errors(cases, method):
    return [(c["pred"][method] - c["observation"]) ** 2 for c in cases]


def assess(cases, method):
    if not cases:
        return {"n_sites": 0, "status": "INSUFFICIENT_DATA"}
    errors = [c["pred"][method]-c["observation"] for c in cases]
    return {
        "n_sites": len(cases),
        "mae": round(mean([abs(e) for e in errors]), 6),
        "rmse": round(math.sqrt(mean([e*e for e in errors])), 6),
        "mean_bias": round(mean(errors), 6),
        "skill_mse_vs_global": round(1-mean([e*e for e in errors])/
                                      mean(squared_errors(cases, "global")), 6)
        if sum(squared_errors(cases, "global")) > 0 else None,
    }


def tune_k(means, habitats, year):
    """Nested: choose k by rolling years <= year-1 only, never future."""
    origins = [t for t in range(2019, year) if t >= 2019]
    if not origins:
        return 8, {}
    scores = {}
    for k in K_GRID:
        cases = [
            c for origin in origins for c in test_cases(means, habitats, origin, k)
            if c["previous_years"] >= 1
        ]
        scores[k] = mean(squared_errors(cases, "country_shrink")) if cases else float("inf")
    return min(K_GRID, key=lambda k: (scores[k], k)), scores


def bootstrap_improvement(cases, target, baseline="global", repetitions=TRIALS):
    """Paired site bootstrap; CI pertains to this year's observed-sites mix."""
    if len(cases) < 2:
        return {"status": "INSUFFICIENT_SITES"}
    rng = random.Random(SEED)
    n = len(cases)
    diffs = [abs(c["pred"][baseline]-c["observation"])-
             abs(c["pred"][target]-c["observation"]) for c in cases]
    draws = sorted(mean([diffs[rng.randrange(n)] for _ in range(n)])
                   for _ in range(repetitions))
    return {
        "mae_improvement": round(mean(diffs), 5),
        "percentile_CI_95": [round(draws[int(0.025 * repetitions)], 5),
                             round(draws[int(0.975 * repetitions)-1], 5)],
        "repetitions": repetitions,
        "seed": SEED,
        "caveat": "site-resampling, not proof for future years or unseen regions",
    }


def conformal_interval(means, habitats, t, method, k):
    """Prior-origin absolute residual interval; empirical check on future year."""
    previous_cases = [
        c for origin in range(2019, t)
        for c in test_cases(means, habitats, origin, k)
    ]
    residuals = sorted(abs(c["pred"][method]-c["observation"])
                       for c in previous_cases)
    if len(residuals) < 40:
        return {"status": "INSUFFICIENT_CALIBRATION", "n_calibration": len(residuals)}
    # Split-conformal finite-sample nominal 90% interval, heuristic for dependent
    # site/time residuals; empirical coverage must be checked and reported.
    q_index = min(len(residuals)-1, math.ceil((len(residuals)+1)*0.9)-1)
    margin = residuals[q_index]
    cases = test_cases(means, habitats, t, k)
    cover = sum(max(0, c["pred"][method]-margin) <= c["observation"]
                <= c["pred"][method]+margin for c in cases)
    return {
        "status": "BACKTEST_ONLY",
        "nominal_coverage": 0.9,
        "empirical_coverage": round(cover/len(cases), 5) if cases else None,
        "half_width": round(margin, 5),
        "n_calibration": len(residuals),
        "n_test": len(cases),
        "warning": "temporal and spatial dependence mean 90% nominal is not automatically guaranteed",
    }


def spatial_holdout(means, habitats, year=2023):
    """No history from held-out site is used to predict it."""
    sites = {site for (site, yr) in means if yr == year}
    withheld = {site for site in sites
                if int.from_bytes(sha256(("ECO|"+"|".join(site)).encode()).digest()[:4],"big")%5==0}
    if not withheld:
        return {"status": "INSUFFICIENT_SPATIAL_HOLDOUT"}
    cases = test_cases(means, habitats, year, 8, exclude_sites=withheld, only_sites=withheld)
    assert all(c["previous_years"] == 0 for c in cases)
    return {
        "site_count": len(cases),
        "models": {name: assess(cases,name) for name in ("global","country")},
        "warning": "UK spatial unseen-site test, not Japan/world transfer validation",
    }


def rules_gate(*, country, protocol, target, model_validated, same_domain, known_base):
    missing = []
    if not country or country not in {"England", "Scotland", "Wales", "Northern Ireland"}:
        missing.append("unsupported_country")
    if protocol != "UKPoMS_1km_FIT_10min":
        missing.append("unvalidated_protocol")
    if target != "site_year_FIT_mean":
        missing.append("unvalidated_target")
    if not model_validated:
        missing.append("model_not_validated")
    if not same_domain:
        missing.append("out_of_domain")
    if not known_base:
        missing.append("baseline_unavailable")
    return {"status": "NOT_ESTIMABLE" if missing else "ELIGIBLE_FOR_VALIDATED_MODEL",
            "missing": missing}


def self_test():
    toy = {
        (("England", "A"), 2017): 2, (("England", "A"), 2018): 4,
        (("England", "B"), 2018): 6, (("England", "A"), 2019): 5,
    }
    f = historical_facts(toy, {}, 2019)
    assert f["country"]["England"] == 4
    assert predictions(f, ("England","A"), 2)["country_shrink"] == 3.5
    swapped = dict(toy); swapped[(("England","A"),2019)] = 10000
    assert historical_facts(toy, {}, 2019) == historical_facts(swapped, {}, 2019)
    assert all(c["previous_years"] == 0 for c in
               test_cases(toy, {}, 2019, 8, exclude_sites={("England","A")}, only_sites={("England","A")}))
    assert rules_gate(country="Japan", protocol="UKPoMS_1km_FIT_10min",
                      target="site_year_FIT_mean", model_validated=True,
                      same_domain=True,known_base=True)["status"] == "NOT_ESTIMABLE"
    assert rules_gate(country="England", protocol="UKPoMS_1km_FIT_10min",
                      target="site_year_FIT_mean", model_validated=True,
                      same_domain=True,known_base=True)["missing"] == []
    print("PASS: no target-year leakage, strict spatial holdout, applicability gate")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--self-test",action="store_true")
    parser.add_argument("--out",default="poms-multiyear-validation.json")
    opts=parser.parse_args()
    if opts.self_test:
        self_test();return
    means,habitats,audit=load_official()
    folds={}
    for year in REPORT_YEARS:
        k, tuning=tune_k(means,habitats,year)
        cases=test_cases(means,habitats,year,k)
        folds[str(year)]={
            "year":year,"chosen_k_without_year_leakage":k,
            "n_sites":len(cases),
            "sites_with_history":sum(c["previous_years"]>0 for c in cases),
            "model_metrics":{m:assess(cases,m) for m in MODELS},
            "nested_calibration_years":list(range(2019,year)),
        }
    _,tuning = tune_k(means,habitats,2023)
    k=folds["2023"]["chosen_k_without_year_leakage"]
    heldout=test_cases(means,habitats,2023,k)
    report={
        "official_source":"UK PoMS (2026), EIDC, DOI:10.5285/d706088c-9d48-4be5-b156-6ed6ad5e0618, OGL",
        "verified_CSV_sha256":SURVEY_SHA256,
        "experimental_scope":"Annual UK 1km FIT recorded visit means, NOT ecosystem health.",
        "audit":audit,"multiple_year_prequential_backtests":folds,
        "heldout_2023_paired_bootstrap":{
           m:bootstrap_improvement(heldout,m) for m in ("country_shrink","habitat_shrink","country_trend_shrink")
        },
        "heldout_2023_90pct_intervals":{
           m:conformal_interval(means,habitats,2023,m,k) for m in ("global","country_shrink","habitat_shrink")
        },
        "unseen_2023_sites":spatial_holdout(means,habitats),
        "applicability_tests":{
            "uk_study_site":{
                "country":"England","protocol":"UKPoMS_1km_FIT_10min",
                "target":"site_year_FIT_mean","model_validated":True,
                "same_domain":True,"known_base":True,
            },
            "japan_out_of_domain":{
                "country":"Japan","protocol":"UKPoMS_1km_FIT_10min",
                "target":"site_year_FIT_mean","model_validated":True,
                "same_domain":False,"known_base":False,
            },
            "no_model_validation":{
                "country":"England","protocol":"UKPoMS_1km_FIT_10min",
                "target":"site_year_FIT_mean","model_validated":False,
                "same_domain":True,"known_base":True,
            },
        },
        "limitations":[
          "No additional user field surveys required",
          "No 2023 training labels used in 2023 model selection or features",
          "Country/habitat categories use only past observations, not target-year habitat",
          "Within-year survey times and flower choices can cause composition bias",
          "The 2023 outcomes were reviewed in earlier project phases; new methods are exploratory, not preregistered",
          "Site-year means are rates of recorded visits, not abundances",
          "Absolute-error intervals are diagnostics; nominal coverage not guaranteed under dependence",
          "No general prediction of ecosystem health or future ecological collapse",
        ]
    }
    report["applicability_tests"]={k:rules_gate(**v) for k,v in report["applicability_tests"].items()}
    Path(opts.out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2)[:32000])


if __name__=="__main__":
    main()
