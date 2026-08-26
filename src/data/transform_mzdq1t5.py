#!/usr/bin/env python3
"""Filter average gross income rows from MZDQ1T5.csv."""

import csv
from pathlib import Path

BASE_DIR = Path(__file__).parent
SRC = BASE_DIR / "MZDQ1T5.csv"
DST = BASE_DIR / "MZDQ1T5-transform.csv"

METRIC = "Průměrná hrubá měsíční mzda na přepočtené počty zaměstnanců (Kč)"


def main() -> None:
    with SRC.open(newline="", encoding="utf-8-sig") as f_in, DST.open(
        "w", newline="", encoding="utf-8"
    ) as f_out:
        reader = csv.DictReader(f_in)
        if reader.fieldnames is None or "Ukazatel" not in reader.fieldnames:
            raise ValueError("Input CSV is missing the 'Ukazatel' column")

        writer = csv.DictWriter(f_out, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(row for row in reader if row["Ukazatel"] == METRIC)


if __name__ == "__main__":
    main()
