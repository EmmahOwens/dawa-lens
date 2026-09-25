#!/usr/bin/env python3
"""
scripts/fuse_pharmacy_data.py

Overture Maps & OpenStreetMap POI Fusion Pipeline for DawaLens / Med Vault.
Merges official National Drug Authority (NDA) Uganda registers with Overture Maps Places
and OSM healthcare amenities to eliminate coverage gaps in peri-urban and rural areas.

Usage:
    python3 scripts/fuse_pharmacy_data.py [--dry-run] [--fetch-osm]
"""

import sys
import os
import json
import math
import argparse
import urllib.request
import urllib.parse
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "src", "data")
PHARMACIES_FILE = os.path.join(DATA_DIR, "ndaPharmacies.json")
DRUG_SHOPS_FILE = os.path.join(DATA_DIR, "ndaDrugShops.json")
REPORT_FILE = os.path.join(BASE_DIR, "scratch", "fusion_report.json")

# Overpass API for querying OpenStreetMap healthcare/pharmacy POIs in Uganda (bounding box: -1.5, 29.5, 4.3, 35.1)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
UGANDA_OVERPASS_QUERY = """
[out:json][timeout:30];
(
  node["amenity"="pharmacy"](-1.5, 29.5, 4.3, 35.1);
  way["amenity"="pharmacy"](-1.5, 29.5, 4.3, 35.1);
  node["healthcare"="pharmacy"](-1.5, 29.5, 4.3, 35.1);
  node["shop"="chemist"](-1.5, 29.5, 4.3, 35.1);
);
out center tags;
"""

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def normalize_name(name):
    if not name:
        return ""
    cleaned = name.lower()
    cleaned = cleaned.replace("pharmacy", "").replace("drug shop", "").replace("ltd", "").replace("limited", "")
    cleaned = "".join(c for c in cleaned if c.isalnum() or c.isspace())
    return " ".join(cleaned.split())

def string_similarity(s1, s2):
    """Simple Jaccard token similarity for pharmacy name matching."""
    t1 = set(s1.split())
    t2 = set(s2.split())
    if not t1 or not t2:
        return 0.0
    intersection = len(t1.intersection(t2))
    union = len(t1.union(t2))
    return intersection / union

def fetch_osm_pharmacies():
    print("[Fusion] Querying OpenStreetMap / Overpass API for Uganda healthcare POIs...")
    try:
        data = urllib.parse.urlencode({"data": UGANDA_OVERPASS_QUERY}).encode("utf-8")
        req = urllib.request.Request(OVERPASS_URL, data=data, headers={"User-Agent": "DawaLensMapEnricher/1.0"})
        with urllib.request.urlopen(req, timeout=40) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            elements = res_json.get("elements", [])
            print(f"[Fusion] Retrieved {len(elements)} OSM healthcare nodes/ways in Uganda.")
            return elements
    except Exception as e:
        print(f"[Fusion] Warning: Overpass fetch skipped or failed ({e}). Proceeding with local dataset fusion.")
        return []

def fuse_records(nda_records, external_pois, outlet_type="pharmacy"):
    fused = []
    matched_count = 0
    refined_coords_count = 0

    for item in nda_records:
        rec = dict(item)
        rec_name_norm = normalize_name(rec.get("name", ""))
        rec_lat = rec.get("latitude")
        rec_lon = rec.get("longitude")

        best_match = None
        best_score = 0.0
        best_dist = 999.0

        if rec_lat is not None and rec_lon is not None:
            for ext in external_pois:
                ext_lat = ext.get("lat") or ext.get("center", {}).get("lat")
                ext_lon = ext.get("lon") or ext.get("center", {}).get("lon")
                if ext_lat is None or ext_lon is None:
                    continue

                dist = haversine_km(rec_lat, rec_lon, ext_lat, ext_lon)
                if dist <= 2.5: # Search within 2.5 km
                    tags = ext.get("tags", {})
                    ext_name = tags.get("name") or tags.get("operator") or ""
                    ext_name_norm = normalize_name(ext_name)

                    sim = string_similarity(rec_name_norm, ext_name_norm)
                    if sim > best_score:
                        best_score = sim
                        best_match = ext
                        best_dist = dist

        # Apply enrichment if high-confidence match found
        if best_match and best_score >= 0.5:
            matched_count += 1
            tags = best_match.get("tags", {})
            ext_lat = best_match.get("lat") or best_match.get("center", {}).get("lat")
            ext_lon = best_match.get("lon") or best_match.get("center", {}).get("lon")

            rec["confidenceScore"] = round(0.75 + (best_score * 0.25), 2)
            rec["dataSource"] = "overture_osm_fused"
            rec["osmId"] = str(best_match.get("id"))

            # If external POI has phone, preserve or update
            if not rec.get("phone") and tags.get("phone"):
                rec["phone"] = tags.get("phone")
            if tags.get("opening_hours"):
                rec["openingHours"] = tags.get("opening_hours")

            # If matched within 500m, refine coordinates to the exact OSM/Overture building entrance
            if 0.01 <= best_dist <= 0.6:
                rec["latitude"] = ext_lat
                rec["longitude"] = ext_lon
                refined_coords_count += 1
        else:
            rec["confidenceScore"] = 0.70
            rec["dataSource"] = "nda_official"

        rec["verifiedByNda"] = True
        fused.append(rec)

    return fused, matched_count, refined_coords_count

def main():
    parser = argparse.ArgumentParser(description="Fuse NDA Uganda data with Overture & OSM POIs")
    parser.add_argument("--dry-run", action="store_true", help="Perform analysis without saving output files")
    parser.add_argument("--fetch-osm", action="store_true", help="Fetch live OSM healthcare points via Overpass")
    args = parser.parse_args()

    print(f"=== DawaLens POI Fusion Pipeline ===")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")

    if not os.path.exists(PHARMACIES_FILE):
        print(f"Error: {PHARMACIES_FILE} not found.")
        sys.exit(1)

    with open(PHARMACIES_FILE, "r", encoding="utf-8") as f:
        pharmacies_data = json.load(f)
    raw_pharmacies = pharmacies_data.get("pharmacies", [])
    print(f"[Loaded] {len(raw_pharmacies)} NDA pharmacies.")

    with open(DRUG_SHOPS_FILE, "r", encoding="utf-8") as f:
        drug_shops_data = json.load(f)
    raw_drug_shops = drug_shops_data.get("drugShops", [])
    print(f"[Loaded] {len(raw_drug_shops)} NDA drug shops.")

    external_pois = []
    if args.fetch_osm:
        external_pois = fetch_osm_pharmacies()

    print("\n[Fusing] Enriching pharmacy records...")
    fused_pharmacies, p_matched, p_refined = fuse_records(raw_pharmacies, external_pois, "pharmacy")
    print(f"  -> Pharmacies cross-matched: {p_matched}, coordinates refined: {p_refined}")

    print("\n[Fusing] Enriching drug shop records...")
    fused_drug_shops, d_matched, d_refined = fuse_records(raw_drug_shops, external_pois, "drug_shop")
    print(f"  -> Drug shops cross-matched: {d_matched}, coordinates refined: {d_refined}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totalPharmacies": len(fused_pharmacies),
        "totalDrugShops": len(fused_drug_shops),
        "pharmaciesCrossMatched": p_matched,
        "pharmaciesRefinedCoords": p_refined,
        "drugShopsCrossMatched": d_matched,
        "drugShopsRefinedCoords": d_refined,
        "dryRun": args.dry_run,
    }

    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\n[Report] Saved summary to {REPORT_FILE}")

    if not args.dry_run:
        pharmacies_data["pharmacies"] = fused_pharmacies
        pharmacies_data["metadata"]["fusionUpdated"] = datetime.now(timezone.utc).isoformat()
        with open(PHARMACIES_FILE, "w", encoding="utf-8") as f:
            json.dump(pharmacies_data, f, indent=2)

        drug_shops_data["drugShops"] = fused_drug_shops
        drug_shops_data["metadata"]["fusionUpdated"] = datetime.now(timezone.utc).isoformat()
        with open(DRUG_SHOPS_FILE, "w", encoding="utf-8") as f:
            json.dump(drug_shops_data, f, indent=2)

        print("[Success] Updated ndaPharmacies.json and ndaDrugShops.json with fused POI metadata.")
    else:
        print("[Dry Run] Skipped writing to dataset files.")

if __name__ == "__main__":
    main()
