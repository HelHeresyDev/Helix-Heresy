"""Focused source-coverage and ODS/XLSX artifact checks; no gameplay suite is run."""
import csv
import importlib.util
import posixpath
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_STORED

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('creature_catalog_builder', ROOT / 'scripts/build-creature-catalog.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CreatureCatalogTests(unittest.TestCase):
    def test_runtime_tissue_numbers_and_selective_diets_are_exported(self):
        rows = {r[0]: r for r in self.data['tissues']}
        self.assertAlmostEqual(sum(r[1] for k, r in rows.items() if k != 'legacy'), 1)
        self.assertEqual(rows['hard'][2:7], [.005, .1, .15, .1, .65])
        self.assertAlmostEqual(rows['hard'][8], .1)
        self.assertEqual(rows['flesh'][1], .6)
        self.assertIn('unknown', rows['legacy'][1])
        self.assertEqual(len(rows), 9)

    @classmethod
    def setUpClass(cls):
        cls.data = builder.load_data()
        cls.workbook = ROOT / 'reference/creature-catalog.xlsx'

    def test_complete_unique_current_catalog_and_separate_proposals(self):
        rows = self.data['creatures']
        self.assertEqual(len(rows), 36)
        ids = [row[-1] for row in rows]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids[:12]), {'human', 'slime', 'mudlet', 'homunculus', 'cinderling', 'zephyrMote', 'rootling', 'sporecap', 'hauntbound', 'quartzShardling', 'duskcat', 'lanternWisp'})
        self.assertEqual({row[1] for row in self.data['ecology']}, set(ids[12:]))
        self.assertEqual(len(self.data['ecology']), 24)
        self.assertEqual(self.data['planned'], [])
        self.assertNotIn('boneSkitter', ids)
        self.assertTrue(all(row[2].startswith('Proposed only') for row in self.data['planned']))

    def test_authored_tiers_and_material_costs_are_not_fabricated(self):
        rows = {r[-1]: r for r in self.data['creatures']}
        self.assertEqual(rows['slime'][3:5], [0, 0])
        self.assertIn('10 biomass', rows['slime'][5])
        self.assertEqual(rows['mudlet'][3:5], [0, 0])
        self.assertEqual(rows['mudlet'][5], '2 common clay + 2 drinking water')
        self.assertEqual(rows['homunculus'][3:5], ['Not defined — advanced'] * 2)
        self.assertEqual(rows['homunculus'][5], '60 biomass + 18 prepared growth medium + 6 genetic material + 1 examined human tissue template')
        self.assertEqual(rows['cinderling'][3:6], [0, 0, '2 charcoal'])
        self.assertEqual(rows['zephyrMote'][3:5], [1, 0])
        self.assertIn('0.1 m³', rows['zephyrMote'][5])
        self.assertEqual(rows['rootling'][3:5], [1, 0])
        self.assertEqual(rows['rootling'][5], '1 plant propagule + 2 drinking water + 1 nutrient medium')
        self.assertEqual(rows['sporecap'][3:6], [0, 0, '1 fungal starter + 1 plant compost + 1 drinking water'])
        self.assertIn('not producible', rows['hauntbound'][4])
        self.assertIn('No creation recipe', rows['hauntbound'][5])
        self.assertIn('personal animancy', rows['hauntbound'][3])
        self.assertEqual(rows['quartzShardling'][3:6], [1, 0, '1 quartz + 1 mineral salts + 1 drinking water'])
        self.assertIn('only quartz grows/repairs', rows['quartzShardling'][11])
        self.assertEqual(rows['duskcat'][3:6], [2, 0, '1 duskcat embryo + 2 biomass + 1 nutrient medium + 1 drinking water'])
        self.assertIn('never burns flesh', rows['duskcat'][8])
        self.assertIn('no room dimming', rows['duskcat'][11])
        self.assertEqual(rows['lanternWisp'][3:6], [2, 0, '1 glow salts'])
        self.assertIn('no phasing', rows['lanternWisp'][10])
        self.assertIn('0.5/hour', rows['lanternWisp'][11])
        for row in self.data['creatures'][12:]:
            self.assertEqual(row[3:5], ['Not defined', 'Not defined'])
            self.assertIn('no implemented player-production recipe', row[5])
        self.assertTrue(all(r[4] == 0 for r in self.data['planned']))
        self.assertTrue(all('quantities not defined' in r[5] for r in self.data['planned']))

    def test_biomes_prevalence_and_implementation_limits(self):
        beasts = {r[0]: r for r in self.data['ecology']}
        self.assertEqual(beasts['Ashhorn Behemoth'][2], 'Temperate Grassland; Shrubland; Desert')
        self.assertEqual(beasts['Ashhorn Behemoth'][6], 2)
        self.assertEqual(beasts['Nullmaw Stalker'][7], '1–2')
        self.assertEqual(beasts['Reef Wyrm'][2], 'Reef Shelf; Upwelling Ocean; Tropical Ocean')
        self.assertEqual(beasts['Mirror Ape'][17], 'Bounded contact consumers; not generic wilderness spawning')
        self.assertEqual(beasts['Glasswing Roc'][17], 'Shared body and individual behavior; population encounters pending')
        self.assertEqual(beasts['Glasswing Roc'][19:26], [8, 3, 4, 20, 30000, 6, 8 / 3])
        self.assertEqual(beasts['Mirror Ape'][23], 90)
        self.assertTrue(all(len(row) == 27 for row in beasts.values()))
        self.assertTrue(all(row[-2] and row[-1] for row in self.data['creatures']))
        self.assertTrue(any(row[0] == 'Dog' for row in self.data['forms']))
        self.assertTrue(any('Divine avatar' == row[0] for row in self.data['forms']))

    def test_xlsx_contents_filters_freezes_and_types_round_trip(self):
        definitions = builder.sheet_definitions(self.data, '2026-11-12')
        builder.validate_workbook(self.workbook, definitions)
        with ZipFile(self.workbook) as archive:
            rows = builder.read_sheet_rows(archive, 2)
            self.assertEqual(rows[5][3], 0)
            self.assertIsInstance(rows[5][3], float)
            self.assertEqual(rows[4][0], 'Human')
            self.assertTrue(rows[7][3].startswith('Not defined'))
            self.assertEqual(rows[8][0], 'Cinderling')
            self.assertEqual(rows[8][3:5], [0, 0])
            self.assertEqual(rows[9][0], 'Zephyr Mote')
            self.assertEqual(rows[9][3:5], [1, 0])
            self.assertEqual(rows[10][0], 'Rootling')
            self.assertEqual(rows[10][3:5], [1, 0])
            self.assertEqual(rows[11][0], 'Sporecap')
            self.assertEqual(rows[11][3:5], [0, 0])

    def test_ooxml_relationships_resolve_and_have_no_external_dependencies(self):
        with ZipFile(self.workbook) as archive:
            members = set(archive.namelist())
            for name in members:
                if not name.endswith('.rels'):
                    continue
                base = '' if name == '_rels/.rels' else name.split('/_rels/')[0]
                for relation in ET.fromstring(archive.read(name)):
                    self.assertNotEqual(relation.attrib.get('TargetMode'), 'External')
                    target = posixpath.normpath(posixpath.join(base, relation.attrib['Target']))
                    self.assertIn(target, members, f'{name} points outside the workbook: {target}')

    def test_csv_matches_current_catalog_without_losing_utf8(self):
        with (ROOT / 'reference/creature-catalog.csv').open(encoding='utf-8-sig', newline='') as handle:
            rows = list(csv.reader(handle))
        self.assertEqual(rows[0], self.data['headers'])
        self.assertEqual(rows[1:], [[str(value) for value in row] for row in self.data['creatures']])

    def test_numeric_ecological_rates_are_real_numbers_in_both_workbooks(self):
        definitions = builder.sheet_definitions(self.data, '2026-11-12')
        self.assertEqual(len(definitions), 9)
        rate_index = next(i for i, d in enumerate(definitions, 1) if d[0] == 'Ecological rates')
        expected = self.data['rates']
        self.assertEqual(len(expected), 36)
        with ZipFile(self.workbook) as xlsx, ZipFile(ROOT / 'reference/creature-catalog.ods') as ods:
            tables = ET.fromstring(ods.read('content.xml')).findall('office:body/office:spreadsheet/table:table', builder.ODF)
            outputs = [builder.read_sheet_rows(xlsx, rate_index)[4:], builder.read_ods_rows(tables[rate_index - 1])[4:]]
            for rows in outputs:
                self.assertEqual(rows, expected)
                for row in rows:
                    self.assertTrue(all(isinstance(n, (int, float)) for n in row[4:16]), row[0])
                    self.assertTrue(all(n >= 0 for n in row[4:16]), row[0])
                ants = next(row for row in rows if row[-1] == 'beast:ember-ant')
                self.assertEqual(ants[4], 0.000002, 'tiny rates must not be rounded into missing/zero cells')
                self.assertEqual(ants[13], 0.0004)
                self.assertEqual(next(row for row in rows if row[-1] == 'beast:ironroot-colossus')[4:6], [40, 4])
                self.assertEqual(next(row for row in rows if row[-1] == 'hauntbound')[4:16], [0] * 12)
            catalog = builder.read_sheet_rows(xlsx, 2)[4:]
            for row in catalog:
                self.assertTrue(all(isinstance(n, (int, float)) for n in row[16:28]), row[0])

    def test_lifecycle_values_are_typed_and_complete_in_both_workbooks(self):
        definitions = builder.sheet_definitions(self.data, '2026-11-12')
        index = next(i for i, d in enumerate(definitions, 1) if d[0] == 'Lifecycle & resource use')
        headers, expected = self.data['lifecycleHeaders'], self.data['lifecycles']
        self.assertEqual(len(expected), 36)
        def field(row, label):
            return row[headers.index(label)]
        with ZipFile(self.workbook) as xlsx, ZipFile(ROOT / 'reference/creature-catalog.ods') as ods:
            tables = ET.fromstring(ods.read('content.xml')).findall('office:body/office:spreadsheet/table:table', builder.ODF)
            outputs = [builder.read_sheet_rows(xlsx, index)[4:], builder.read_ods_rows(tables[index - 1])[4:]]
            for rows in outputs:
                self.assertEqual(rows, expected)
                by_id = {row[-1]: row for row in rows}
                for row in rows:
                    for label in ['Food / organic substrate (kg/day)', 'Direct water demand (L/day)',
                                  'Attempts per reproductive unit / 365 days', 'Established offspring per successful event',
                                  'Birth to adult body (days)', 'Background adult hazard / 1000 individual-days']:
                        self.assertIsInstance(field(row, label), (int, float), (row[0], label))
                self.assertEqual(field(by_id['duskcat'], 'Food / organic substrate (kg/day)'), 0.288)
                self.assertEqual(field(by_id['duskcat'], 'Direct water demand (L/day)'), 0.6)
                self.assertEqual(field(by_id['hauntbound'], 'Birth to first reproductive eligibility (days)'), 'N/A')
                self.assertEqual(field(by_id['hauntbound'], 'Established offspring per successful event'), 0)
                self.assertEqual(field(by_id['beast:ember-ant'], 'Parental breeder background hazard / 1000 days'), 0.02)
                self.assertEqual(field(by_id['beast:ember-ant'], 'Background adult hazard / 1000 individual-days'), 3)
            for row in builder.read_sheet_rows(xlsx, 2)[4:]:
                self.assertTrue(all(isinstance(n, (int, float)) for n in row[31:37]))

class OdsArtifactTests(unittest.TestCase):
    """Conversion checks do not require unchanged live gameplay/document sources."""
    @classmethod
    def setUpClass(cls):
        cls.workbook = ROOT / 'reference/creature-catalog.xlsx'
        with ZipFile(cls.workbook) as archive:
            workbook = ET.fromstring(archive.read('xl/workbook.xml'))
            names = [s.attrib['name'] for s in workbook.findall(f'{{{builder.NS}}}sheets/{{{builder.NS}}}sheet')]
            cls.definitions = []
            for index, name in enumerate(names, 1):
                rows = builder.read_sheet_rows(archive, index)
                cls.definitions.append((name, rows[0][0], rows[1][0], rows[3], rows[4:], [], ''))

    def test_ods_all_sheets_and_typed_values_match_existing_workbook(self):
        builder.validate_ods(ROOT / 'reference/creature-catalog.ods', self.definitions)
        with ZipFile(ROOT / 'reference/creature-catalog.ods') as archive:
            content = ET.fromstring(archive.read('content.xml'))
            tables = content.findall('office:body/office:spreadsheet/table:table', builder.ODF)
            with ZipFile(self.workbook) as xlsx:
                for index, table in enumerate(tables, 1):
                    actual = builder.read_ods_rows(table)
                    expected = builder.read_sheet_rows(xlsx, index)
                    self.assertEqual(actual[3:], expected[3:])
            catalog = builder.read_ods_rows(tables[1])
            self.assertEqual(catalog[4][0], 'Human')
            self.assertIsInstance(catalog[5][3], float)
            self.assertEqual(catalog[5][3], 0)

    def test_ods_package_manifest_is_self_contained_and_native_format(self):
        with ZipFile(ROOT / 'reference/creature-catalog.ods') as archive:
            first = archive.infolist()[0]
            self.assertEqual(first.filename, 'mimetype')
            self.assertEqual(first.compress_type, ZIP_STORED)
            self.assertEqual(first.extra, b'')
            self.assertEqual(archive.read('mimetype').decode('ascii'), builder.ODS_MIME)
            manifest = ET.fromstring(archive.read('META-INF/manifest.xml'))
            entries = {e.get(builder.odf_name('manifest:full-path')): e.get(builder.odf_name('manifest:media-type')) for e in manifest}
            self.assertEqual(entries.pop('/'), builder.ODS_MIME)
            self.assertEqual(set(entries), {'content.xml', 'styles.xml', 'settings.xml', 'meta.xml'})
            for member, mime in entries.items():
                self.assertIn(member, archive.namelist())
                self.assertEqual(mime, 'text/xml')

    def test_ods_filters_wrapping_and_native_calc_frozen_panes(self):
        definitions = self.definitions
        with ZipFile(ROOT / 'reference/creature-catalog.ods') as archive:
            content = ET.fromstring(archive.read('content.xml'))
            ranges = content.findall('.//table:database-range', builder.ODF)
            self.assertEqual(len(ranges), 9)
            for database, definition in zip(ranges, definitions):
                name, _, _, headers, rows, _, _ = definition
                self.assertEqual(database.get(builder.odf_name('table:target-range-address')),
                                 f"'{name}'.A4:'{name}'.{builder.column(len(headers))}{len(rows) + 4}")
                self.assertEqual(database.get(builder.odf_name('table:display-filter-buttons')), 'true')
            self.assertTrue(content.findall('.//style:table-cell-properties', builder.ODF))
            for style in content.findall('.//style:table-cell-properties', builder.ODF):
                self.assertEqual(style.get(builder.odf_name('fo:wrap-option')), 'wrap')
            settings = ET.fromstring(archive.read('settings.xml'))
            panes = settings.findall('.//config:config-item-map-named/config:config-item-map-entry', builder.ODF)
            self.assertEqual(len(panes), len(definitions))
            for pane, definition in zip(panes, definitions):
                self.assertEqual(pane.get(builder.odf_name('config:name')), definition[0])
                values = {item.get(builder.odf_name('config:name')): item.text for item in pane}
                self.assertEqual(values['HorizontalSplitMode'], '2')
                self.assertEqual(values['VerticalSplitMode'], '2')
                self.assertEqual(values['VerticalSplitPosition'], '4')


if __name__ == '__main__':
    unittest.main(verbosity=2)
