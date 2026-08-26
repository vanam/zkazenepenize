import csv
from pathlib import Path

SRC = Path(__file__).parent / "CEN0402.csv"
DST = Path(__file__).parent / "CEN0402-transformed.csv"


def main() -> None:
    with SRC.open(newline="", encoding="utf-8-sig") as f_in, DST.open(
        "w", newline="", encoding="utf-8"
    ) as f_out:
        reader = csv.reader(f_in)
        writer = csv.writer(f_out)

        header = next(reader)
        period_idx = header.index("Roční a 3-letá období")
        writer.writerow(header)

        for row in reader:
            if not row:
                continue
            period = row[period_idx]
            # keep only single-year periods (e.g. "2019"), drop e.g. "2019-2021"
            if "-" in period:
                continue
            writer.writerow(row)


if __name__ == "__main__":
    main()
