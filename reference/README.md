# Creature reference

For Linux, open **[creature-catalog.ods](creature-catalog.ods)** in LibreOffice Calc.
This is the native OpenDocument format, with all six sheets, formatting, filters
and frozen headers. Double-click the file, or run this from the repository root:

```sh
libreoffice --calc reference/creature-catalog.ods
```

The original **[XLSX workbook](creature-catalog.xlsx)** is also retained for Excel
and other compatible applications. Both workbooks contain:

- Catalog: humans, slime, Mudlet, Cinderling, Zephyr Mote, Rootling, human-derived homunculus and all 24 beast species (31 entries).
- Production detail: per-creature ingredients, process costs, equipment, utilities and care.
- Beast ecology: decoded biomes, comparative prevalence, threat, movement and social traits.
- Planned creatures: the six separate pending proposals, not implemented recipes.
- Other life & forms: explicit dog lore and divine, avatar, scientist and receiver distinctions.
- Read me: interpretation, scope, source revision and design limits.

Filters are in row 4; headers and identifying columns stay frozen. Unknown values
are explicitly **Not defined**, not invented zeroes. Human-derived homunculus
numeric tiers are unassigned. Beast rarity uses the actual comparative prevalence
rank rather than invented spawn percentages. No particular world census is implied.
Research tier and production/synthesis tier are independent.

[The CSV](creature-catalog.csv) contains the primary catalog only; additional sheets
and formatting are in the ODS/XLSX workbooks. [The preview](creature-catalog-preview.png) shows
selected columns/rows from the same dataset, not every sheet.

Rebuild the snapshots with:

```sh
python3 scripts/build-creature-catalog.py --as-of 2026-11-05
PYTHONDONTWRITEBYTECODE=1 python3 tests/creature-catalog.test.py
```

To build only the Linux-native ODS without replacing existing XLSX, CSV or preview
files, add `--format ods` to the build command.

To check the existing ODS conversion against the XLSX without requiring the source
documents to remain at their original locations:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tests/creature-catalog.test.py OdsArtifactTests
```

Source citations refer to the captured source files. The displayed revision is
the repository base; a rebuild can include working-tree changes against that base.
If source documents are relocated, the exporter's source paths must be updated
before full regeneration; this does not affect opening the existing workbooks.

The exporter reads existing runtime definitions and current pending proposals;
manual annotations live in `scripts/creature-catalog-data.js`. It changes no gameplay
definitions. ODS/XLSX/CSV generation uses Python's standard library and Node.js;
the optional PNG preview additionally uses Pillow. Rebuilding replaces these named
generated snapshots, so retain manual workbook edits separately if desired.
