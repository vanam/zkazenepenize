#!/usr/bin/env python3
"""Transform CEN0101H.csv into CEN0101H-transformed.csv.

Keep only rows with "Průměrná roční míra inflace" where CASRMX contains the whole year
(no month). Output columns: Rok, Průměrná roční míra inflace.
"""

import csv
from pathlib import Path

BASE_DIR = Path(__file__).parent
SRC = BASE_DIR / "CEN0101H.csv"
DST = BASE_DIR / "CEN0101H-transformed.csv"

FIELDNAMES = ["Rok", "Průměrná roční míra inflace"]


def main() -> None:
    with SRC.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    out_rows = []
    for row in rows:
        if (row.get("Ukazatel") or "").strip() != "Průměrná roční míra inflace":
            continue
        casrmx = (row.get("CASRMX") or "").strip()
        if not (casrmx.isdigit() and len(casrmx) == 4):
            continue
        out_rows.append(
            {
                "Rok": casrmx,
                "Průměrná roční míra inflace": (row.get("Hodnota") or "").strip(),
            }
        )

    out_rows.sort(key=lambda r: int(r["Rok"]))

    with DST.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(out_rows)


if __name__ == "__main__":
    main()
