#!/usr/bin/env python3
"""Build a dependency-free ODS/XLSX/CSV reference from the game's authored definitions.

Usage: python3 scripts/build-creature-catalog.py [--as-of YYYY-MM-DD]
No gameplay files are modified. --format ods leaves existing XLSX/CSV/PNG files unchanged.
"""
import argparse
import csv
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import textwrap
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reference'
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
ET.register_namespace('', NS)
ET.register_namespace('r', REL)


def element(name, attributes=None, parent=None, text=None):
    node = ET.Element(f'{{{NS}}}{name}', attributes or {})
    if parent is not None:
        parent.append(node)
    if text is not None:
        node.text = str(text)
    return node


def column(index):
    result = ''
    while index:
        index, digit = divmod(index - 1, 26)
        result = chr(65 + digit) + result
    return result


def xml(node):
    return ET.tostring(node, encoding='utf-8', xml_declaration=True)


def load_data():
    node = os.environ.get('NODE_BINARY') or shutil.which('node')
    if not node:
        candidates = sorted((Path.home() / '.nvm/versions/node').glob('*/bin/node'))
        node = str(candidates[-1]) if candidates else None
    if not node:
        raise RuntimeError('Node.js is required to read the existing JavaScript definitions.')
    result = subprocess.run([node, str(ROOT / 'scripts/creature-catalog-data.js')], cwd=ROOT,
                            check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    try:
        data['revision'] = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        pass
    return data


def sheet_definitions(data, as_of):
    summary = f'Source snapshot {as_of} · base {data["revision"]} · {len(data["creatures"])} current entries / {len(data["ecology"])} beast species / {len(data["planned"])} proposals'
    catalog_widths = [29, 23, 40, 20, 20, 57, 62, 46, 54, 58, 48, 51, 92, 65, 33]
    return [
        ('Read me', 'HELIX HERESY / Creature reference', summary, ['Field', 'Meaning / limits'], data['guide'], [28, 135], '17324D'),
        ('Catalog', 'CREATURE CATALOG / Current definitions', summary, data['headers'], data['creatures'], catalog_widths, '117D89'),
        ('Production detail', 'PRODUCTION / Separate costs and prerequisites', 'Per-creature ingredients are not equipment, research or market-price totals.',
         ['Procedure', 'Applies to', 'Cost basis', 'Material input', 'Mana / services', 'Base time', 'Equipment / capex', 'Gates / care', 'Limits / accounting notes', 'Source'],
         data['production'], [43, 35, 39, 73, 90, 75, 90, 96, 103, 70], '117D89'),
        ('Beast ecology', 'BEAST ECOLOGY / All 24 authored species', 'Prevalence is comparative and seeded. Population-record counts are not individual animal counts.',
         ['Creature', 'Stable ID', 'Decoded biomes', 'Biome codes', 'Realm', 'Mana aspects', 'Prevalence rank / 4', 'Population records / world',
          'Threat rank / 4', 'Threat band', 'Size band', 'Intelligence', 'Movement', 'Diet', 'Ecological role', 'Social pattern', 'Lair / breeding site', 'Local implementation', 'Authored description', 'Source'],
         data['ecology'], [29, 35, 65, 22, 14, 25, 20, 27, 18, 20, 20, 20, 34, 26, 28, 30, 30, 62, 105, 48], '315E86'),
        ('Planned creatures', 'PLANNED / Not implemented or finally balanced', 'Amber rows are proposals. Ingredients are qualitative; exact quantities, rarity and natural map biomes are not assigned.',
         data['headers'], data['planned'], catalog_widths, 'BA751B'),
        ('Other life & forms', 'OTHER LIFE / Lore examples and identity states', 'These rows are not additional implemented species or ordinary manufacturing recipes.',
         ['Name / form', 'Classification', 'Status', 'Research tier', 'Production tier', 'Production cost', 'Habitat / rarity limits', 'Identity / design notes', 'Source'],
         data['forms'], [40, 48, 55, 50, 50, 75, 95, 120, 75], '725585')
    ]


def styles():
    root = element('styleSheet')
    fonts = element('fonts', {'count': '6'}, root)
    for size, color, bold, italic, family in [
        (10, '24394A', False, False, 'Calibri'), (21, 'FFFFFF', True, False, 'Calibri'),
        (10, 'DCE8ED', False, False, 'Calibri'), (10, 'FFFFFF', True, False, 'Calibri'),
        (10, '10645D', True, False, 'Calibri'), (9, '657382', False, False, 'Consolas')]:
        f = element('font', parent=fonts)
        element('sz', {'val': str(size)}, f)
        element('color', {'rgb': 'FF' + color}, f)
        element('name', {'val': family}, f)
        if bold:
            element('b', parent=f)
        if italic:
            element('i', parent=f)
    fills = element('fills', {'count': '7'}, root)
    for kind, color in [('none', None), ('gray125', None), ('solid', '17324D'), ('solid', 'FFFFFF'),
                        ('solid', 'F0F6F8'), ('solid', 'DDF2E9'), ('solid', 'FFF1D8')]:
        fill = element('fill', parent=fills)
        pattern = element('patternFill', {'patternType': kind}, fill)
        if color:
            element('fgColor', {'rgb': 'FF' + color}, pattern)
            element('bgColor', {'indexed': '64'}, pattern)
    borders = element('borders', {'count': '2'}, root)
    for colored in [False, True]:
        border = element('border', parent=borders)
        for side in ['left', 'right', 'top', 'bottom', 'diagonal']:
            line = element(side, {'style': 'hair'} if colored and side == 'bottom' else {}, border)
            if colored and side == 'bottom':
                element('color', {'rgb': 'FFD8E3E9'}, line)
    base = element('cellStyleXfs', {'count': '1'}, root)
    element('xf', {'numFmtId': '0', 'fontId': '0', 'fillId': '0', 'borderId': '0'}, base)
    xfs = element('cellXfs', {'count': '10'}, root)
    for font, fill, border in [(0, 3, 0), (1, 2, 0), (2, 2, 0), (3, 2, 0), (0, 3, 1),
                               (0, 4, 1), (4, 5, 1), (0, 6, 1), (3, 6, 1), (5, 3, 1)]:
        xf = element('xf', {'numFmtId': '0', 'fontId': str(font), 'fillId': str(fill), 'borderId': str(border),
                            'xfId': '0', 'applyAlignment': '1', 'applyFont': '1', 'applyFill': '1', 'applyBorder': '1'}, xfs)
        element('alignment', {'vertical': 'top', 'wrapText': '1'}, xf)
    cells = element('cellStyles', {'count': '1'}, root)
    element('cellStyle', {'name': 'Normal', 'xfId': '0', 'builtinId': '0'}, cells)
    return root


def write_cell(row, ref, value, style):
    is_number = isinstance(value, (int, float)) and not isinstance(value, bool)
    c = element('c', {'r': ref, 's': str(style), 't': 'n' if is_number else 'inlineStr'}, row)
    if is_number:
        element('v', parent=c, text=value)
    else:
        inline = element('is', parent=c)
        element('t', {'{http://www.w3.org/XML/1998/namespace}space': 'preserve'}, inline, text=value)


def worksheet(index, definition):
    name, title, subtitle, headers, rows, widths, color = definition
    last = f'{column(len(headers))}{len(rows) + 4}'
    root = element('worksheet')
    props = element('sheetPr', parent=root)
    element('tabColor', {'rgb': 'FF' + color}, props)
    element('dimension', {'ref': f'A1:{last}'}, root)
    views = element('sheetViews', parent=root)
    view = element('sheetView', {'workbookViewId': '0', 'showGridLines': '0', 'zoomScale': '85'}, views)
    splits = min(2, len(headers) - 1)
    element('pane', {'xSplit': str(splits), 'ySplit': '4', 'topLeftCell': f'{column(splits + 1)}5',
                     'activePane': 'bottomRight', 'state': 'frozen'}, view)
    element('selection', {'pane': 'bottomRight', 'activeCell': f'{column(splits + 1)}5', 'sqref': f'{column(splits + 1)}5'}, view)
    element('sheetFormatPr', {'defaultRowHeight': '18'}, root)
    cols = element('cols', parent=root)
    for i, width in enumerate(widths, 1):
        element('col', {'min': str(i), 'max': str(i), 'width': str(width), 'customWidth': '1'}, cols)
    body = element('sheetData', parent=root)
    for number, content, style, height in [(1, title, 1, 37), (2, subtitle, 2, 31),
                                           (3, 'Filter row 4 · freeze panes preserve names and headers · unassigned values are explicit, never invented zeroes.', 9, 27)]:
        row = element('row', {'r': str(number), 'ht': str(height), 'customHeight': '1'}, body)
        for i in range(1, len(headers) + 1):
            write_cell(row, f'{column(i)}{number}', content if i == 1 else '', style)
    header = element('row', {'r': '4', 'ht': '34', 'customHeight': '1'}, body)
    for i, value in enumerate(headers, 1):
        write_cell(header, f'{column(i)}4', value, 3)
    for r, values in enumerate(rows, 5):
        if len(values) != len(headers):
            raise ValueError(f'{name}: row {r} has {len(values)} cells, expected {len(headers)}')
        height = 70 if name == 'Read me' else 128 if name == 'Production detail' else 116 if name == 'Other life & forms' else 105
        row = element('row', {'r': str(r), 'ht': str(height), 'customHeight': '1'}, body)
        for i, value in enumerate(values, 1):
            style = 4 if r % 2 else 5
            if isinstance(value, (int, float)) and headers[i - 1] in ['Research tier', 'Production tier']:
                style = 6
            elif str(value).startswith('Not defined') or str(value).startswith('Proposed only'):
                style = 7
            elif headers[i - 1] in ['Source', 'Stable ID', 'Biome codes']:
                style = 9
            write_cell(row, f'{column(i)}{r}', value, style)
    merges = element('mergeCells', {'count': '3'}, root)
    for r in [1, 2, 3]:
        element('mergeCell', {'ref': f'A{r}:{column(len(headers))}{r}'}, merges)
    element('pageMargins', {'left': '.3', 'right': '.3', 'top': '.5', 'bottom': '.5', 'header': '.2', 'footer': '.2'}, root)
    tables = element('tableParts', {'count': '1'}, root)
    element('tablePart', {f'{{{REL}}}id': 'rId1'}, tables)
    table = element('table', {'id': str(index), 'name': f'CreatureReference{index}', 'displayName': f'CreatureReference{index}',
                              'ref': f'A4:{last}', 'totalsRowShown': '0'})
    element('autoFilter', {'ref': f'A4:{last}'}, table)
    columns = element('tableColumns', {'count': str(len(headers))}, table)
    for i, h in enumerate(headers, 1):
        element('tableColumn', {'id': str(i), 'name': h}, columns)
    element('tableStyleInfo', {'name': 'TableStyleMedium2', 'showFirstColumn': '0', 'showLastColumn': '0',
                               'showRowStripes': '1', 'showColumnStripes': '0'}, table)
    return root, table


def relationships(entries):
    root = ET.Element(f'{{{PKG_REL}}}Relationships')
    for ident, kind, target in entries:
        ET.SubElement(root, f'{{{PKG_REL}}}Relationship', {'Id': ident, 'Type': f'{REL}/{kind}', 'Target': target})
    return root


def build_workbook(path, data, as_of):
    definitions = sheet_definitions(data, as_of)
    workbook = element('workbook')
    views = element('bookViews', parent=workbook)
    element('workbookView', {'activeTab': '1', 'windowWidth': '24000', 'windowHeight': '14000'}, views)
    sheets = element('sheets', parent=workbook)
    content_ns = 'http://schemas.openxmlformats.org/package/2006/content-types'
    content = ET.Element(f'{{{content_ns}}}Types')
    for suffix, kind in [('rels', 'application/vnd.openxmlformats-package.relationships+xml'), ('xml', 'application/xml')]:
        ET.SubElement(content, f'{{{content_ns}}}Default', {'Extension': suffix, 'ContentType': kind})
    overrides = [('/xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'),
                 ('/xl/styles.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'),
                 ('/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml')]
    with ZipFile(path, 'w', ZIP_DEFLATED) as archive:
        workbook_rels = []
        for i, definition in enumerate(definitions, 1):
            name = definition[0]
            element('sheet', {'name': name, 'sheetId': str(i), f'{{{REL}}}id': f'rId{i}'}, sheets)
            sheet, table = worksheet(i, definition)
            archive.writestr(f'xl/worksheets/sheet{i}.xml', xml(sheet))
            archive.writestr(f'xl/tables/table{i}.xml', xml(table))
            archive.writestr(f'xl/worksheets/_rels/sheet{i}.xml.rels', xml(relationships([('rId1', 'table', f'../tables/table{i}.xml')])))
            workbook_rels.append((f'rId{i}', 'worksheet', f'worksheets/sheet{i}.xml'))
            overrides.extend([(f'/xl/worksheets/sheet{i}.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'),
                              (f'/xl/tables/table{i}.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml')])
        workbook_rels.append((f'rId{len(definitions) + 1}', 'styles', 'styles.xml'))
        archive.writestr('xl/workbook.xml', xml(workbook))
        archive.writestr('xl/_rels/workbook.xml.rels', xml(relationships(workbook_rels)))
        archive.writestr('xl/styles.xml', xml(styles()))
        root_rels = relationships([('rId1', 'officeDocument', 'xl/workbook.xml')])
        ET.SubElement(root_rels, f'{{{PKG_REL}}}Relationship', {'Id': 'rId2',
                      'Type': 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'Target': 'docProps/core.xml'})
        archive.writestr('_rels/.rels', xml(root_rels))
        cp = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'
        dc = 'http://purl.org/dc/elements/1.1/'
        core = ET.Element(f'{{{cp}}}coreProperties')
        ET.SubElement(core, f'{{{dc}}}title').text = 'Helix Heresy — Creature Reference'
        ET.SubElement(core, f'{{{dc}}}creator').text = 'Helix Heresy'
        ET.SubElement(core, f'{{{dc}}}description').text = f'Authored creature/design reference; source {data["revision"]}; snapshot {as_of}.'
        archive.writestr('docProps/core.xml', xml(core))
        for part, kind in overrides:
            ET.SubElement(content, f'{{{content_ns}}}Override', {'PartName': part, 'ContentType': kind})
        archive.writestr('[Content_Types].xml', xml(content))
    return definitions


def read_sheet_rows(archive, index):
    root = ET.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml'))
    rows = []
    for row in root.findall(f'{{{NS}}}sheetData/{{{NS}}}row'):
        values = []
        for cell in row.findall(f'{{{NS}}}c'):
            if cell.attrib.get('t') == 'inlineStr':
                values.append(''.join(cell.itertext()))
            else:
                val = cell.find(f'{{{NS}}}v')
                values.append(float(val.text) if val is not None else '')
        rows.append(values)
    return rows


def validate_workbook(path, definitions):
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError('Workbook ZIP checksum failure')
        for name in archive.namelist():
            if name.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(name))
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        names = [s.attrib['name'] for s in workbook.findall(f'{{{NS}}}sheets/{{{NS}}}sheet')]
        assert names == [d[0] for d in definitions]
        for i, definition in enumerate(definitions, 1):
            actual = read_sheet_rows(archive, i)
            assert actual[3] == definition[3], f'{definition[0]} headers changed'
            assert actual[4:] == definition[4], f'{definition[0]} data changed'
            table = ET.fromstring(archive.read(f'xl/tables/table{i}.xml'))
            expected = f'A4:{column(len(definition[3]))}{len(definition[4]) + 4}'
            assert table.attrib['ref'] == expected
            assert table.find(f'{{{NS}}}autoFilter').attrib['ref'] == expected
            sheet = ET.fromstring(archive.read(f'xl/worksheets/sheet{i}.xml'))
            assert sheet.find(f'{{{NS}}}sheetViews/{{{NS}}}sheetView/{{{NS}}}pane').attrib['state'] == 'frozen'
            assert not sheet.findall(f'.//{{{NS}}}f'), 'Reference workbook should contain no formulas'


ODF = {
    'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
    'style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
    'fo': 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
    'svg': 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
    'manifest': 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
    'config': 'urn:oasis:names:tc:opendocument:xmlns:config:1.0',
    'meta': 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
    'dc': 'http://purl.org/dc/elements/1.1/',
}
ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'
for prefix, namespace in ODF.items():
    ET.register_namespace(prefix, namespace)


def odf_name(name):
    prefix, local = name.split(':', 1)
    return f'{{{ODF[prefix]}}}{local}'


def odf_element(name, attributes=None, parent=None, text=None):
    node = ET.Element(odf_name(name), {odf_name(k): str(v) for k, v in (attributes or {}).items()})
    if parent is not None:
        parent.append(node)
    if text is not None:
        node.text = str(text)
    return node


def ods_cell(row, value, style, span=1):
    number = isinstance(value, (int, float)) and not isinstance(value, bool)
    attrs = {'table:style-name': style, 'office:value-type': 'float' if number else 'string'}
    if number:
        attrs['office:value'] = value
    if span > 1:
        attrs['table:number-columns-spanned'] = span
    cell = odf_element('table:table-cell', attrs, row)
    odf_element('text:p', parent=cell, text=value)
    for _ in range(span - 1):
        odf_element('table:covered-table-cell', parent=row)


def build_ods(path, data, as_of):
    definitions = sheet_definitions(data, as_of)
    content = odf_element('office:document-content', {'office:version': '1.2'})
    automatic = odf_element('office:automatic-styles', parent=content)
    for name, background, foreground, size, weight in [
        ('Title', '#17324D', '#FFFFFF', '21pt', 'bold'),
        ('Subtitle', '#17324D', '#DCE8ED', '10pt', 'normal'),
        ('Note', '#FFFFFF', '#657382', '9pt', 'normal'),
        ('Header', '#17324D', '#FFFFFF', '10pt', 'bold'),
        ('Body', '#FFFFFF', '#24394A', '10pt', 'normal'),
        ('Alternate', '#F0F6F8', '#24394A', '10pt', 'normal'),
        ('Tier', '#DDF2E9', '#10645D', '10pt', 'bold'),
        ('Unknown', '#FFF1D8', '#24394A', '10pt', 'normal'),
        ('Source', '#FFFFFF', '#657382', '9pt', 'normal')]:
        style = odf_element('style:style', {'style:name': name, 'style:family': 'table-cell'}, automatic)
        odf_element('style:table-cell-properties', {'fo:background-color': background, 'fo:wrap-option': 'wrap',
                    'fo:padding': '0.06cm', 'style:vertical-align': 'top'}, style)
        odf_element('style:text-properties', {'style:font-name': 'Liberation Sans', 'fo:font-size': size,
                    'fo:font-weight': weight, 'fo:color': foreground}, style)
    for name, height in [('TitleRow', '.98cm'), ('SubtitleRow', '.78cm'), ('NoteRow', '.7cm'),
                         ('HeaderRow', '.9cm'), ('DataRow', '1.8cm')]:
        style = odf_element('style:style', {'style:name': name, 'style:family': 'table-row'}, automatic)
        odf_element('style:table-row-properties', {'style:min-row-height': height, 'style:use-optimal-row-height': 'true'}, style)
    for index, definition in enumerate(definitions, 1):
        for col, width in enumerate(definition[5], 1):
            style = odf_element('style:style', {'style:name': f'Column{index}_{col}', 'style:family': 'table-column'}, automatic)
            odf_element('style:table-column-properties', {'style:column-width': f'{width * .18:.2f}cm'}, style)
    body = odf_element('office:body', parent=content)
    spreadsheet = odf_element('office:spreadsheet', parent=body)
    for index, (name, title, subtitle, headers, rows, widths, color) in enumerate(definitions, 1):
        table = odf_element('table:table', {'table:name': name}, spreadsheet)
        for col in range(1, len(headers) + 1):
            odf_element('table:table-column', {'table:style-name': f'Column{index}_{col}'}, table)
        header_rows = odf_element('table:table-header-rows', parent=table)
        for value, style, row_style in [(title, 'Title', 'TitleRow'), (subtitle, 'Subtitle', 'SubtitleRow'),
                ('Filter row 4 · names and headers stay frozen · unassigned values are explicit.', 'Note', 'NoteRow')]:
            row = odf_element('table:table-row', {'table:style-name': row_style}, header_rows)
            ods_cell(row, value, style, len(headers))
        row = odf_element('table:table-row', {'table:style-name': 'HeaderRow'}, header_rows)
        for h in headers:
            ods_cell(row, h, 'Header')
        for r, values in enumerate(rows):
            if len(values) != len(headers):
                raise ValueError(f'{name}: mismatched ODS column count')
            row = odf_element('table:table-row', {'table:style-name': 'DataRow'}, table)
            for h, value in zip(headers, values):
                style = 'Body' if r % 2 else 'Alternate'
                if isinstance(value, (int, float)) and h in ['Research tier', 'Production tier']:
                    style = 'Tier'
                elif str(value).startswith(('Not defined', 'Proposed only')):
                    style = 'Unknown'
                elif h in ['Source', 'Stable ID', 'Biome codes']:
                    style = 'Source'
                ods_cell(row, value, style)
    ranges = odf_element('table:database-ranges', parent=spreadsheet)
    for index, definition in enumerate(definitions, 1):
        name, _, _, headers, rows, _, _ = definition
        quoted = "'" + name.replace("'", "''") + "'"
        address = f'{quoted}.A4:{quoted}.{column(len(headers))}{len(rows) + 4}'
        odf_element('table:database-range', {'table:name': f'CreatureReference{index}',
                    'table:target-range-address': address, 'table:display-filter-buttons': 'true',
                    'table:contains-header': 'true', 'table:orientation': 'row'}, ranges)
    styles_document = odf_element('office:document-styles', {'office:version': '1.2'})
    faces = odf_element('office:font-face-decls', parent=styles_document)
    odf_element('style:font-face', {'style:name': 'Liberation Sans', 'svg:font-family': "'Liberation Sans'"}, faces)
    style_set = odf_element('office:styles', parent=styles_document)
    default = odf_element('style:default-style', {'style:family': 'table-cell'}, style_set)
    odf_element('style:text-properties', {'style:font-name': 'Liberation Sans', 'fo:font-size': '10pt'}, default)
    settings = odf_element('office:document-settings', {'office:version': '1.2'})
    office_settings = odf_element('office:settings', parent=settings)
    view_settings = odf_element('config:config-item-set', {'config:name': 'ooo:view-settings'}, office_settings)
    views = odf_element('config:config-item-map-indexed', {'config:name': 'Views'}, view_settings)
    view = odf_element('config:config-item-map-entry', parent=views)
    odf_element('config:config-item', {'config:name': 'ActiveTable', 'config:type': 'string'}, view, text='Catalog')
    odf_element('config:config-item', {'config:name': 'ShowGrid', 'config:type': 'boolean'}, view, text='false')
    tables = odf_element('config:config-item-map-named', {'config:name': 'Tables'}, view)
    for name, _, _, headers, _, _, _ in definitions:
        table = odf_element('config:config-item-map-entry', {'config:name': name}, tables)
        frozen_cols = min(2, len(headers) - 1)
        for key, value, kind in [('HorizontalSplitMode', 2, 'short'), ('VerticalSplitMode', 2, 'short'),
                                ('HorizontalSplitPosition', frozen_cols, 'int'), ('VerticalSplitPosition', 4, 'int'),
                                ('PositionLeft', 0, 'int'), ('PositionRight', frozen_cols, 'int'),
                                ('PositionTop', 0, 'int'), ('PositionBottom', 4, 'int'), ('ActiveSplitRange', 3, 'short')]:
            odf_element('config:config-item', {'config:name': key, 'config:type': kind}, table, text=value)
    meta = odf_element('office:document-meta', {'office:version': '1.2'})
    metadata = odf_element('office:meta', parent=meta)
    odf_element('dc:title', parent=metadata, text='Helix Heresy — Creature Reference')
    odf_element('meta:generator', parent=metadata, text='Helix Heresy creature reference exporter')
    odf_element('dc:description', parent=metadata, text=f'Authored definitions; source {data["revision"]}; snapshot {as_of}.')
    manifest = odf_element('manifest:manifest', {'manifest:version': '1.2'})
    odf_element('manifest:file-entry', {'manifest:full-path': '/', 'manifest:media-type': ODS_MIME,
                                      'manifest:version': '1.2'}, manifest)
    parts = {'content.xml': content, 'styles.xml': styles_document, 'settings.xml': settings, 'meta.xml': meta}
    for name in parts:
        odf_element('manifest:file-entry', {'manifest:full-path': name, 'manifest:media-type': 'text/xml'}, manifest)
    with ZipFile(path, 'w', ZIP_DEFLATED) as archive:
        # ODF requires an uncompressed first entry with no BOM or extra field.
        archive.writestr('mimetype', ODS_MIME, compress_type=ZIP_STORED)
        for name, document in parts.items():
            archive.writestr(name, xml(document))
        archive.writestr('META-INF/manifest.xml', xml(manifest))
    return definitions


def read_ods_rows(table):
    result = []
    for row in table.findall('.//table:table-row', ODF):
        values = []
        for cell in row.findall('table:table-cell', ODF):
            if cell.get(odf_name('office:value-type')) == 'float':
                values.append(float(cell.get(odf_name('office:value'))))
            else:
                values.append('\n'.join(''.join(p.itertext()) for p in cell.findall('text:p', ODF)))
        result.append(values)
    return result


def validate_ods(path, definitions):
    with ZipFile(path) as archive:
        first = archive.infolist()[0]
        assert first.filename == 'mimetype' and first.compress_type == ZIP_STORED and not first.extra
        assert archive.read('mimetype').decode('ascii') == ODS_MIME
        assert archive.testzip() is None
        for name in archive.namelist():
            if name.endswith('.xml'):
                ET.fromstring(archive.read(name))
        content = ET.fromstring(archive.read('content.xml'))
        tables = content.findall('office:body/office:spreadsheet/table:table', ODF)
        assert [t.get(odf_name('table:name')) for t in tables] == [d[0] for d in definitions]
        for table, definition in zip(tables, definitions):
            rows = read_ods_rows(table)
            assert rows[3] == definition[3], f'{definition[0]}: ODS header mismatch'
            assert rows[4:] == definition[4], f'{definition[0]}: ODS data mismatch'
        assert len(content.findall('.//table:database-range', ODF)) == len(definitions)
        assert all(odf_name('table:formula') not in cell.attrib for cell in content.findall('.//table:table-cell', ODF))


def preview(path, data, as_of):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    font_dir = Path('/usr/share/fonts/truetype/liberation')
    if not font_dir.exists():
        return False
    regular = ImageFont.truetype(str(font_dir / 'LiberationSans-Regular.ttf'), 15)
    bold = ImageFont.truetype(str(font_dir / 'LiberationSans-Bold.ttf'), 16)
    title_font = ImageFont.truetype(str(font_dir / 'LiberationSans-Bold.ttf'), 29)
    widths = [225, 170, 135, 135, 275, 340, 290]
    width, row_height = sum(widths), 144
    preview_rows = data['creatures'][:9]
    image = Image.new('RGB', (width, 160 + row_height * len(preview_rows)), '#FFFFFF')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 100), fill='#17324D')
    draw.text((22, 16), 'HELIX HERESY / CREATURE CATALOG', font=title_font, fill='white')
    draw.text((22, 59), f'{as_of} · {len(data["creatures"])} current entries · {len(data["ecology"])} beast species · {len(data["planned"])} proposals on a separate tab', font=regular, fill='#DCE8ED')
    indices = [0, 1, 3, 4, 5, 6, 7]
    labels = ['Creature', 'Group', 'Research tier', 'Production tier', 'Per-creature materials', 'Biome / habitat', 'Rarity / prevalence']
    x = 0
    for label, w in zip(labels, widths):
        draw.rectangle((x, 100, x + w, 144), fill='#117D89')
        draw.text((x + 10, 113), label, font=bold, fill='white')
        x += w
    for r, record in enumerate(preview_rows):
        y, x = 144 + r * row_height, 0
        draw.rectangle((0, y, width, y + row_height), fill='#F0F6F8' if r % 2 == 0 else 'white')
        for index, w in zip(indices, widths):
            value = str(record[index])
            if index in (3, 4) and isinstance(record[index], int):
                draw.rectangle((x + 4, y + 4, x + w - 4, y + row_height - 4), fill='#DDF2E9')
            if value.startswith('Not defined'):
                draw.rectangle((x + 4, y + 4, x + w - 4, y + row_height - 4), fill='#FFF1D8')
            lines = textwrap.wrap(value, width=max(10, int((w - 22) / 7.8)))
            for j, line in enumerate(lines[:7]):
                draw.text((x + 11, y + 10 + j * 18), line, font=regular, fill='#24394A')
            draw.line((x + w, y, x + w, y + row_height), fill='#D8E3E9')
            x += w
    draw.text((14, image.height - 18), 'Data preview; the ODS/XLSX workbooks contain full notes, sources, filters and additional sheets.', font=regular, fill='#657382')
    image.save(path)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--as-of', default=dt.date.today().isoformat())
    parser.add_argument('--format', choices=['all', 'ods', 'xlsx'], default='all',
                        help='Build only the selected workbook; all also refreshes CSV/preview.')
    args = parser.parse_args()
    dt.date.fromisoformat(args.as_of)
    data = load_data()
    OUTPUT.mkdir(exist_ok=True)
    built = []
    if args.format in ['all', 'xlsx']:
        workbook = OUTPUT / 'creature-catalog.xlsx'
        definitions = build_workbook(workbook, data, args.as_of)
        validate_workbook(workbook, definitions)
        built.append(workbook.name)
    if args.format in ['all', 'ods']:
        workbook = OUTPUT / 'creature-catalog.ods'
        definitions = build_ods(workbook, data, args.as_of)
        validate_ods(workbook, definitions)
        built.append(workbook.name)
    if args.format == 'all':
        with (OUTPUT / 'creature-catalog.csv').open('w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.writer(handle)
            writer.writerow(data['headers'])
            writer.writerows(data['creatures'])
        preview(OUTPUT / 'creature-catalog-preview.png', data, args.as_of)
    print(f'Built and validated {", ".join(built)}: {len(data["creatures"])} catalog entries, '
          f'{len(data["ecology"])} beasts, {len(data["planned"])} proposals, {len(definitions)} sheets.')


if __name__ == '__main__':
    main()
