"""Revisión rápida antes de publicar: cada archivo local que una página pide (src/href) existe, y ningún
script propio tiene errores de sintaxis. La corre GitHub en cada cambio (.github/workflows/revisar.yml).
Uso: python3 herramientas/revisar.py"""
import pathlib, re, subprocess, sys

raiz = pathlib.Path(__file__).resolve().parent.parent
fallas = []
for pagina in sorted(raiz.glob('*.html')):
    for ruta in re.findall(r'(?:src|href)="([^"#?]+)', pagina.read_text(encoding='utf-8')):
        if re.match(r'[a-z]+:|//', ruta) or not ruta.strip():
            continue   # enlaces a otros sitios, tel:, mailto:, data:
        if not (raiz / ruta).exists():
            fallas.append(f'{pagina.name}: no existe «{ruta}»')
for guion in sorted([*raiz.glob('js/*.js'), raiz / 'sw.js']):
    r = subprocess.run(['node', '--check', str(guion)], capture_output=True, text=True)
    if r.returncode:
        fallas.append(f'{guion.name}: {r.stderr.strip().splitlines()[0]}')
print('\n'.join(fallas) or 'Todo bien: los archivos existen y los scripts no tienen errores de sintaxis.')
sys.exit(1 if fallas else 0)
