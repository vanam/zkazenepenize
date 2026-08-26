# Zkažené peníze

Výplata roste. Ale bohatnete? Jednoduchá webová kalkulačka kupní síly — porovnejte svůj čistý roční příjem v čase s inflací, bydlením, zlatem, bitcoinem nebo S&P 500.

Žádná registrace, žádný backend. Data zůstávají jen ve vašem prohlížeči.

## Jak to funguje

1. **Přidáte svůj příjem** — nahrajete CSV (`rok,prijem`), necháte si ho odhadnout podle průměrné mzdy ČSÚ, nebo zadáte roky ručně.
2. **Vyberete si pohled** — stejná data, 7 různých kalkulaček. Volitelně přidáte benchmark (druhou datovou řadu pro srovnání) a nasdílíte výsledek odkazem.

Příklad vstupu:

```csv
rok,prijem
2019,350000
2020,400000
2021,420000
```

## Kalkulačky

- **Koruny** — nominální vs. reálný příjem podle oficiální (případně vlastní) inflace
- **EUR a USD** — přepočet podle ročních kurzů
- **Bitcoin** — kolik BTC jste si mohli koupit na konci každého roku
- **S&P 500** — kolik podílů fondu SPY jste si mohli koupit
- **Zlato** — kolik gramů zlata jste si mohli koupit
- **Nemovitosti** — kolik m² bytu/domu podle kraje a velikosti obce
- **Reálná inflace** — poskládejte si vlastní inflaci z BTC, zlata, S&P 500 a nemovitostí podle vlastních vah

Navíc: skrývání hodnot osy Y pro bezpečné sdílení snímků, porovnání s benchmarkem, export zpět do CSV.

## Datasety

Všechna srovnávací data jsou přibalená v `src/data/` jako CSV. Ceny aktiv se berou vždy k 31. 12. daného roku (sloupec `Close`).

| Dataset | Zdroj | Pokrytí v repu | Poznámka |
|---|---|---|---|
| Inflace – průměrná roční míra (CEN0101H) | [ČSÚ – CEN0101H](https://data.csu.gov.cz/datastat/info/SADA/CEN0101H) | 1997–2025 | Filtrováno skriptem `transform_cen0101h.py` |
| Nemovitosti – kupní ceny za m² (CEN0402) | [ČSÚ – CEN0402](https://data.csu.gov.cz/datastat/info/SADA/CEN0402) | 2019–2025 | Jen jednoleté údaje, skript `transform_cen0402.py` |
| Průměrné mzdy pro odhad příjmu (MZDQ1T5) | ČSÚ – průměrné mzdy | 2011–2026 | Pro ukončené roky se bere 4. čtvrtletí, pro aktuální rok nejnovější dostupné; čistý příjem ≈ hrubá mzda × 75 % × 12 |
| Kurzy EUR / USD | [Kurzy.cz – jednotný kurz (dle ČNB)](https://www.kurzy.cz/kurzy-men/jednotny-kurz/) | 2010–2025 | Průměrný roční kurz pro přepočet do CZK |
| Bitcoin (BTC.V) | [Stooq – BTC.V](https://stooq.com/q/d/?s=btc.v) | 2010–2026 | Cena v USD na konci roku |
| Zlato (XAUUSD) | [Stooq – XAUUSD](https://stooq.com/q/d/?s=xauusd) | 2010–2026 | Cena v USD/oz na konci roku |
| S&P 500 (SPY.US) | [Stooq – SPY.US](https://stooq.com/q/d/?s=spy.us) | 2005–2026 | Cena fondu SPDR S&P 500 v USD na konci roku |

> Časové pokrytí se liší podle dostupnosti u zdroje — např. nemovitosti začínají až rokem 2019, bitcoin rokem 2010. Údaje za aktuální rok jsou průběžné a po vydání nových dat u zdroje je potřeba CSV aktualizovat.

## Spuštění lokálně

```bash
npm install
npm run dev     # vývojový server
npm run build   # produkční build do dist/
npm run preview # náhled buildu
```

Technologie: React 19, React Router, Recharts, Vite.

## Upozornění

Jde o orientační vizualizaci kupní síly, ne o investiční doporučení. Historická data nic negarantují a metodiky zdrojů (zejména ČSÚ) se v čase mění.
