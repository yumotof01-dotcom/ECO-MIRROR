"""Independent, read-only Python oracle for real R=1000 test diagnostics; no app dependency."""
import csv
import hashlib
import json
import sys
from collections import Counter
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_SHA = "c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a"
DIAGNOSTIC = json.loads(Path(sys.argv[1]).read_text())
raw = ROOT / "data/raw/moss-evans-2022-flower-visits-v1/Raw_InteractionData_BothYears.csv"
assert hashlib.sha256(raw.read_bytes()).hexdigest() == SOURCE_SHA
with raw.open(newline="") as stream:
    rows = list(csv.DictReader(stream))
assert len(rows) == 3882 and len(DIAGNOSTIC["trials"]) == 1000
assert DIAGNOSTIC["data_identity"]["source_sha256"] == SOURCE_SHA
normalized = ROOT / "data/processed/moss-evans-2022-flower-visits-v1/events.json"
assert hashlib.sha256(normalized.read_bytes()).hexdigest() == DIAGNOSTIC["data_identity"]["normalized_events_sha256"]
reference = Counter((r["Plant"], r["Specimen_ID"]) for r in rows)
denominator = len({p for p, v in reference}) * len({v for p, v in reference})
keys = ["event_count", "plant_label_count", "visitor_label_count", "pair_count", "lost_pair_count", "pair_retention_pct", "connectance_fixed"]
vectors = {key: [] for key in keys}


def saved(value):
    value = Fraction(value)
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def words(seed, trial):
    state, increment, mask = 0, 2 * (54 + trial) + 1, (1 << 64) - 1

    def step():
        nonlocal state
        old = state
        state = (old * 6364136223846793005 + increment) & mask
        z = (((old >> 18) ^ old) >> 27) & ((1 << 32) - 1)
        rotation = old >> 59
        return ((z >> rotation) | (z << ((32 - rotation) & 31))) & ((1 << 32) - 1)

    step()
    state = (state + seed) & mask
    step()
    while True:
        yield step()


for trial in range(1000):
    random = words(42, trial)
    positions = list(range(len(rows)))
    consumed = 0
    k = (len(rows) * 50 + 50) // 100
    for i in range(k):
        bound = len(rows) - i
        threshold = (1 << 32) % bound
        while True:
            word = next(random)
            consumed += 1
            if word >= threshold:
                break
        j = i + word % bound
        positions[i], positions[j] = positions[j], positions[i]
    positions = sorted(positions[:k])
    sample = Counter((rows[i]["Plant"], rows[i]["Specimen_ID"]) for i in positions)
    values = dict(zip(keys, [k, len({p for p, v in sample}), len({v for p, v in sample}), len(sample), len(reference) - len(sample), Fraction(100 * len(sample), len(reference)), Fraction(len(sample), denominator)]))
    expected = DIAGNOSTIC["trials"][trial]
    assert expected["trial_index"] == trial and expected["random_word_count"] == consumed, trial
    ids = [f"sha256:{SOURCE_SHA}:record:{i + 1}" for i in positions]
    digest = hashlib.sha256((json.dumps(ids, separators=(",", ":")) + "\n").encode()).hexdigest()
    assert digest == expected["sampled_ids_sha256"], trial
    for key, value in values.items():
        assert expected[key] == (saved(value) if key in ["pair_retention_pct", "connectance_fixed"] else value), (trial, key)
        vectors[key].append(Fraction(value))


def quantile(ordered, probability):
    h = (len(ordered) - 1) * probability
    j = h.numerator // h.denominator
    if j == len(ordered) - 1:
        return ordered[j]
    return ordered[j] + (h - j) * (ordered[j + 1] - ordered[j])


for key, values in vectors.items():
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    ordered = sorted(values)
    expected = {"valid_count": len(values), "mean": saved(mean), "sample_variance": saved(variance), "sample_sd": {"radicand": saved(variance)}, "min": saved(ordered[0]), "max": saved(ordered[-1]), "quantiles": [{"probability": saved(q), "value": saved(quantile(ordered, q))} for q in [Fraction(1, 40), Fraction(1, 2), Fraction(39, 40)]], "undefined_reasons": {}}
    assert expected == DIAGNOSTIC["summary"][key], key
print("PASS: independent raw-CSV PCG32 reconstruction of all 1000 sample ID hashes/word counts, 7000 scalar values and every exact summary statistic")
