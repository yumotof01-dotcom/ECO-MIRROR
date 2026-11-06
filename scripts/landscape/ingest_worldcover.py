#!/usr/bin/env python3
"""Fetch only a Tokyo 2km crop from the public ESA WorldCover 2021 COG.

Requirements: pip install rasterio pyproj numpy
Run: python scripts/landscape/ingest_worldcover.py --out /tmp/worldcover-shinjuku.json
Public scientific source (not a mock): ESA WorldCover 2021 v200 N33E138.
No account, paid API or other user inputs. Reads COG byte ranges, not full tile.
Fails closed on missing data, failed network, invalid landcover codes or CRS.
"""
import argparse
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds, Window
from rasterio.warp import reproject
from rasterio.transform import from_origin
from pyproj import Transformer

URL = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
       "v200/2021/map/ESA_WorldCover_10m_2021_v200_N33E138_Map.tif")
# Center near Shinjuku Gyoen, Tokyo; public study area, NOT user location.
CENTER_LAT, CENTER_LON = 35.685, 139.711
CRS = "EPSG:6677"  # JGD2011 / Japan Plane Rectangular CS IX (Tokyo area).
RESOLUTION = 10
N = 200
VEGETATION = {10, 20, 30, 40, 90, 95, 100}
OTHER = {50, 60, 70, 80}
KNOWN = VEGETATION | OTHER

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/eco-worldcover-shinjuku.json")
    ap.add_argument("--emit-compressed-stdout", action="store_true",
                    help="Emit an audit-friendly gzip+base64 record to CI logs")
    args = ap.parse_args()

    to_metric = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
    to_geo = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    cx, cy = to_metric.transform(CENTER_LON, CENTER_LAT)
    left, top = cx - 1000, cy + 1000
    transform = from_origin(left, top, RESOLUTION, RESOLUTION)
    corners = [(left, top), (left + 2000, top), (left + 2000, top - 2000), (left, top - 2000)]
    coord = [to_geo.transform(x, y) for x, y in corners]
    w, e = min(p[0] for p in coord), max(p[0] for p in coord)
    s, n = min(p[1] for p in coord), max(p[1] for p in coord)

    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                      GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="2"):
        with rasterio.open(URL) as src:
            if src.crs is None or src.count < 1:
                raise ValueError("Source COG CRS/band missing")
            if not src.crs.to_epsg() == 4326:
                raise ValueError("Unexpected source CRS")
            window = from_bounds(w, s, e, n, transform=src.transform)
            # Reprojection needs a halo: bounding only four target corners and
            # rounding the source window clipped 44 target edge pixels in CI.
            # Eight input pixels of padding are loaded, then destination nodata
            # is still checked strictly instead of silently zero-filled.
            window = Window(window.col_off - 8, window.row_off - 8,
                            window.width + 16, window.height + 16)
            window = window.round_offsets().round_lengths()
            clipped = src.read(1, window=window, boundless=False)
            if clipped.size == 0:
                raise ValueError("Empty source window; incorrect tile")
            source_transform = src.window_transform(window)
            values = np.full((N, N), 255, dtype=np.uint8)
            reproject(source=clipped, destination=values,
                      src_transform=source_transform, src_crs=src.crs,
                      dst_transform=transform, dst_crs=CRS,
                      src_nodata=0, dst_nodata=255,
                      resampling=Resampling.nearest)

    unique, counts = np.unique(values, return_counts=True)
    dist = {str(int(v)): int(c) for v,c in zip(unique,counts)}
    unexpected = [int(v) for v in unique if int(v) not in KNOWN]
    if unexpected:
        raise ValueError("Missing/unknown classes, refusing analysis: " + str(unexpected) + " distribution="+str(dist))
    chars = np.full(values.shape, "O", dtype="U1")
    for k in VEGETATION:
        chars[values == k] = "V"
    rows = ["".join(row.tolist()) for row in chars]
    canonical = "".join(rows).encode("ascii")
    raw_class_hash = hashlib.sha256(values.tobytes(order="C")).hexdigest()
    compact_hash = hashlib.sha256(canonical).hexdigest()
    result = {
        "schema_version": "worldcover-cropped-grid-v1",
        "dataset_id": "esa-worldcover-2021-v200-N33E138-shinjuku-2km",
        "title": "Tokyo Shinjuku Gyoen vicinity, 2km square; 2021 ESA WorldCover class inference",
        "publisher": "ESA WorldCover consortium",
        "source_url": URL,
        "source_product": "ESA WorldCover 10m 2021 v200",
        "source_doi": "10.5281/zenodo.7254221",
        "license": "CC BY 4.0",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
        "source_full_tile_sha256": None,
        "source_full_tile_sha256_reason": "Only a COG window was read; full source tile was not downloaded or hashed.",
        "derived_pixel_class_sha256": raw_class_hash,
        "derived_binary_mask_sha256": compact_hash,
        "crs": CRS,
        "source_crs": "EPSG:4326",
        "resolution_metres": RESOLUTION,
        "width": N, "height": N,
        "center_lon_lat": [CENTER_LON, CENTER_LAT],
        "projected_northwest_metres": [round(left,4),round(top,4)],
        "source_class_histogram": dist,
        "class_mapping": {
            "vegetation": sorted(VEGETATION),
            "other": sorted(OTHER),
            "unknown_handling": "error instead of interpreting missing as non-vegetation"
        },
        "geometry_limitations": "Fixed 2km window, no external movement buffer; edge effects unmeasured.",
        "ecological_limitations": "Land cover is not measured bee habitat, food, dispersal or breeding.",
        "rows": rows,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8")
    print("WORLD_COVER_SUCCESS="+json.dumps({
        "source_url":URL,"pixel_hash":raw_class_hash,"mask_hash":compact_hash,"distribution":dist,
        "width":N,"height":N,"crs":CRS,"file":str(out)
    },sort_keys=True))
    if args.emit_compressed_stdout:
        compressed = gzip.compress(out.read_bytes(),compresslevel=9,mtime=0)
        print("GRID_RESULT_GZIP_B64="+base64.b64encode(compressed).decode("ascii"))

if __name__ == "__main__":
    main()
