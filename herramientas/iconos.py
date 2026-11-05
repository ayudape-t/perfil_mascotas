#!/usr/bin/env python3
"""Íconos de Kutimuy: deja en vendor/iconos/ solo los íconos de Font Awesome que usa el sitio.

Las páginas cargan vendor/iconos/ (unos 30 KB) en vez de la librería completa (unos 380 KB): la ficha que
abre quien encuentra a una mascota, muchas veces con datos móviles, carga más rápido.

  python3 herramientas/iconos.py            regenera vendor/iconos/ a partir de vendor/fontawesome-6.4.0/
  python3 herramientas/iconos.py --revisar  solo comprueba que no falte ningún ícono (sale con error si falta)

Si agregas un ícono nuevo (por ejemplo «fa-solid fa-dog») en una página, vuelve a correrlo:
si no, ese ícono se verá en blanco. Necesita fontTools y brotli:  pip install fonttools brotli
"""
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'vendor' / 'fontawesome-6.4.0'
DESTINO = RAIZ / 'vendor' / 'iconos'
FUENTES = ['fa-solid-900', 'fa-regular-400', 'fa-brands-400']
ICONO = re.compile(r'^((?:\.fa-[a-z0-9-]+:before,?)+)\{content:"\\([0-9a-f]+)"\}$')


def usados():
    """Todas las clases fa-… escritas en las páginas, sus scripts y estilos."""
    nombres = set()
    for f in RAIZ.rglob('*'):
        if f.suffix in ('.html', '.js', '.css') and not {'vendor', '.git', 'herramientas'} & set(f.parts):
            nombres |= set(re.findall(r'fa-[a-z0-9]+(?:-[a-z0-9]+)*', f.read_text(encoding='utf-8', errors='ignore')))
    return nombres


def reglas(css):
    """El CSS minificado en reglas de primer nivel (respeta las llaves anidadas de @keyframes)."""
    salida, nivel, inicio = [], 0, 0
    for i, c in enumerate(css):
        if c == '{':
            nivel += 1
        elif c == '}':
            nivel -= 1
            if nivel == 0:
                salida.append(css[inicio:i + 1])
                inicio = i + 1
    return salida


def recortar(css, nombres):
    """Deja las reglas generales y solo los íconos usados. Devuelve el CSS y los códigos de esos íconos."""
    partes, codigos = [], set()
    for regla in reglas(css):
        m = ICONO.match(regla.strip())
        if m:
            selectores = [s for s in m.group(1).split(',') if s and s[1:-len(':before')] in nombres]
            if selectores:
                partes.append(','.join(selectores) + '{content:"\\' + m.group(2) + '"}')
                codigos.add(int(m.group(2), 16))
        elif regla.lstrip().startswith('@font-face'):
            fuente = re.search(r'webfonts/(fa-[a-z0-9-]+)\.woff2', regla)
            if fuente and fuente.group(1) in FUENTES:   # sin la de compatibilidad con la versión 4
                partes.append(re.sub(r'src:[^;}]+', f'src:url(../webfonts/{fuente.group(1)}.woff2) format("woff2")', regla))
        else:
            partes.append(regla)
    return ''.join(partes), codigos


def main():
    css_completo = (ORIGEN / 'css' / 'all.min.css').read_text(encoding='utf-8')
    nombres = usados()
    todos = {s[1:-len(':before')] for r in reglas(css_completo) if (m := ICONO.match(r.strip())) for s in m.group(1).split(',') if s}
    pedidos = sorted(n for n in nombres if n in todos)

    if '--revisar' in sys.argv:
        recortado = (DESTINO / 'css' / 'iconos.min.css').read_text(encoding='utf-8')
        faltan = [n for n in pedidos if f'.{n}:before' not in recortado]
        print(f'{len(pedidos)} íconos usados; faltan en vendor/iconos: {", ".join(faltan) or "ninguno"}')
        sys.exit(1 if faltan else 0)

    from fontTools import subset
    css, codigos = recortar(css_completo, nombres)
    (DESTINO / 'css').mkdir(parents=True, exist_ok=True)
    (DESTINO / 'webfonts').mkdir(parents=True, exist_ok=True)
    aviso = ('/* Solo los íconos que usa Kutimuy (Font Awesome Free 6.4.0, licencia en vendor/fontawesome-6.4.0/LICENSE.txt).\n'
             '   Si agregas un ícono nuevo, corre: python3 herramientas/iconos.py — si no, se verá en blanco. */\n')
    (DESTINO / 'css' / 'iconos.min.css').write_text(aviso + css, encoding='utf-8')
    for nombre in FUENTES:
        opciones = subset.Options()
        opciones.flavor = 'woff2'
        opciones.layout_features = []
        try:
            fuente = subset.load_font(str(ORIGEN / 'webfonts' / f'{nombre}.woff2'), opciones)
            fuente['glyf']
        except Exception:   # fontTools no siempre lee el woff2 oficial (pasa con fa-regular-400): se usa su .ttf
            fuente = subset.load_font(str(ORIGEN / 'webfonts' / f'{nombre}.ttf'), opciones)
        sub = subset.Subsetter(opciones)
        sub.populate(unicodes=codigos)
        sub.subset(fuente)
        subset.save_font(fuente, str(DESTINO / 'webfonts' / f'{nombre}.woff2'), opciones)
    print(f'{len(pedidos)} íconos · {len(codigos)} códigos · vendor/iconos/ listo')


if __name__ == '__main__':
    main()
