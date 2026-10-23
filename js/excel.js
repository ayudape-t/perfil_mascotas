/*
  © 2026 Helpet. Todos los derechos reservados.
  Prohibida la copia, reproducción o distribución total o parcial de este código, diseño, textos e imágenes sin autorización escrita del titular.
*/
/* Excel (.xlsx) mínimo, sin librerías: una o más hojas con encabezado en negrita y ancho de columnas.
   El .xlsx es un ZIP con unos XML; aquí se arma sin comprimir (método «store»), que Excel abre igual.
   Uso: descargarExcel('placas.xlsx', [{ nombre: 'Placas', columnas: [['Código', 14], ...], filas: [['ABC', 1], ...] }]) */

const _crc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();

function _zip(archivos) {   // [{ nombre, texto }] → Blob
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre), datos = enc.encode(a.texto), crc = _crc(datos);
    const comun = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(datos.length), ...u32(datos.length), ...u16(nombre.length)];
    const local = new Uint8Array([...u32(0x04034B50), ...comun, ...u16(0)]);
    partes.push(local, nombre, datos);
    central.push(new Uint8Array([...u32(0x02014B50), ...u16(20), ...comun, ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nombre);
    pos += local.length + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new Uint8Array([...u32(0x06054B50), ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
  return new Blob([...partes, ...central, fin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const _xml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const _nombreHoja = n => String(n || 'Hoja').replace(/[\\/?*[\]:]/g, '-').slice(0, 31);   // Excel no acepta \ / ? * [ ] :
const _col = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

function _hoja({ columnas, filas }) {
  const celda = (v, r, c, estilo) => {
    const ref = `${_col(c)}${r}`, s = estilo ? ` s="${estilo}"` : '';
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return '';
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${_xml(v)}</t></is></c>`;
  };
  const filasXml = [columnas.map(c => c[0]), ...filas].map((f, i) =>
    `<row r="${i + 1}">${f.map((v, c) => celda(v, i + 1, c, i === 0 ? 1 : 0)).join('')}</row>`).join('');
  const cols = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c[1] || 14}" customWidth="1"/>`).join('');
  const ultima = `${_col(columnas.length - 1)}${filas.length + 1}`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${filasXml}</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`;
}

function descargarExcel(nombreArchivo, hojas) {
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const archivos = [
    { nombre: '[Content_Types].xml', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      hojas.map((h, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
    { nombre: '_rels/.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>` +
      hojas.map((h, i) => `<sheet name="${_xml(_nombreHoja(h.nombre))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>' +
      (hojas.length ? `<definedNames>${hojas.map((h, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${_xml(_nombreHoja(h.nombre)).replace(/'/g, "''")}'!$A$1:$${_col(h.columnas.length - 1)}$${h.filas.length + 1}</definedName>`).join('')}</definedNames>` : '') + '</workbook>' },
    { nombre: 'xl/_rels/workbook.xml.rels', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas.map((h, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${hojas.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}">` +
      '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3B2420"/></patternFill></fill></fills>' +
      '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, texto: _hoja(h) })),
  ];
  const url = URL.createObjectURL(_zip(archivos));
  const a = document.createElement('a');
  a.href = url; a.download = nombreArchivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
