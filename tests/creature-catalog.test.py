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
    @classmethod
    def setUpClass(cls):
        cls.data = builder.load_data()
        cls.workbook = ROOT / 'reference/creature-catalog.xlsx'

    def test_complete_unique_current_catalog_and_separate_proposals(self):
        rows = self.data['creatures']
        self.assertEqual(len(rows), 31)
        ids = [row[-1] for row in rows]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids[:7]), {'human', 'slime', 'mudlet', 'homunculus', 'cinderling', 'zephyrMote', 'rootling'})
        self.assertEqual({row[1] for row in self.data['ecology']}, set(ids[7:]))
        self.assertEqual(len(self.data['ecology']), 24)
        self.assertEqual({row[-1] for row in self.data['planned']}, {f'8-{c}' for c in 'EFGHIJ'})
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
        for row in self.data['creatures'][7:]:
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
        self.assertEqual(beasts['Glasswing Roc'][17], 'Strategic only')
        self.assertTrue(all(row[-2] and row[-1] for row in self.data['creatures']))
        self.assertTrue(any(row[0] == 'Dog' for row in self.data['forms']))
        self.assertTrue(any('Divine avatar' == row[0] for row in self.data['forms']))

    def test_xlsx_contents_filters_freezes_and_types_round_trip(self):
        definitions = builder.sheet_definitions(self.data, '2026-11-05')
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
            self.assertEqual(len(ranges), 6)
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
            self.assertEqual(len(panes), 6)
            for pane, definition in zip(panes, definitions):
                self.assertEqual(pane.get(builder.odf_name('config:name')), definition[0])
                values = {item.get(builder.odf_name('config:name')): item.text for item in pane}
                self.assertEqual(values['HorizontalSplitMode'], '2')
                self.assertEqual(values['VerticalSplitMode'], '2')
                self.assertEqual(values['VerticalSplitPosition'], '4')


if __name__ == '__main__':
    unittest.main(verbosity=2)
