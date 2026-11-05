---
name: Kutimuy
description: Placa con QR y NFC para mascotas, con identidad andina de Huánuco.
colors:
  cafe: "#3b2420"
  oxido: "#b4452b"
  oxido-hondo: "#8f3523"
  ocre: "#e0a24a"
  verde-maiz: "#7f9a3e"
  verde-whatsapp: "#0f7a45"
  verde-whatsapp-hondo: "#0d6d3d"
  crema: "#f8edd1"
  crema-clara: "#fffaf0"
  crema-tenue: "#e9d6b4"
  costura: "#dcc29b"
  noche: "#29170d"
  tinta: "#2b1d1a"
  texto-cuerpo: "#4a3830"
  suave: "#6b5a4d"
typography:
  display:
    fontFamily: "DynaPuff, Fredoka, cursive"
    fontSize: "clamp(30px, 8.4vw, 58px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "DynaPuff, Fredoka, cursive"
    fontSize: "clamp(26px, 6.6vw, 40px)"
    fontWeight: 800
    lineHeight: 1.2
  title:
    fontFamily: "Fredoka, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Fredoka, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Fredoka, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  icono: "14px"
  boton: "18px"
  tarjeta: "20px"
  tela: "26px"
  pildora: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "30px"
  xl: "48px"
components:
  boton-pedir:
    backgroundColor: "{colors.verde-whatsapp}"
    textColor: "#ffffff"
    rounded: "{rounded.boton}"
    padding: "0 22px"
    height: "56px"
  boton-pedir-hover:
    backgroundColor: "{colors.verde-whatsapp-hondo}"
  enlace-secundario:
    textColor: "{colors.oxido-hondo}"
    height: "48px"
  nav-pildora:
    textColor: "{colors.crema}"
    rounded: "{rounded.pildora}"
    padding: "0 14px"
    height: "44px"
  dato:
    backgroundColor: "{colors.crema-clara}"
    textColor: "{colors.cafe}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
    padding: "7px 12px"
  paso:
    backgroundColor: "{colors.cafe}"
    textColor: "{colors.crema}"
    size: "44px"
  icono-ficha:
    backgroundColor: "{colors.cafe}"
    textColor: "{colors.ocre}"
    rounded: "{rounded.icono}"
    size: "46px"
  aviso-telegram:
    backgroundColor: "{colors.crema-clara}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.tarjeta}"
    padding: "13px 15px"
  bloque-compra:
    backgroundColor: "{colors.cafe}"
    textColor: "{colors.crema}"
    padding: "30px 20px 32px"
  barra-fija:
    backgroundColor: "{colors.noche}"
    padding: "10px 14px"
---

# Design System: Kutimuy

## Overview

**Creative North Star: "La tela del comercial"**

Kutimuy se ve como una hoja crema extendida sobre un fondo café andino (fondo.webp sobre noche), cosida con franjas de awayo y poblada por las ilustraciones planas del propio comercial: calles coloniales de Huánuco, el Puente Calicanto, la perrita Princesa. Todo el contenido vive dentro de esa tela; fuera de ella solo quedan la insignia con alas, el acceso «Mis mascotas» y el pie.

El tono es cálido, cercano y de feria de barrio, no de startup: titulares redondos y gruesos en DynaPuff, texto amable en Fredoka, botones grandes y blandos, bordes punteados como costura. La densidad es baja y pensada para celulares de gama baja y personas mayores: una columna en celular, texto de 17–18 px, objetivos táctiles de 44–56 px. En computadora la tela se abre a dos columnas que alternan imagen y texto.

La única acción de venta es verde WhatsApp; el resto de la paleta (café, óxido, ocre, verde maíz, crema) sale del awayo y de las ilustraciones.

**Key Characteristics:**
- Una sola tela crema (máx. 1120 px) con esquinas superiores redondeadas sobre fondo café ilustrado.
- Franjas de awayo de 14 px como único separador entre escenas y secciones.
- Ilustraciones planas del comercial a sangre (4:3 en celular, 16:9 en computadora), nunca fotos de stock.
- DynaPuff 800 para titulares, Fredoka 400–600 para todo lo demás.
- Verde WhatsApp reservado al pedido; ocre para acentos sobre café; óxido para énfasis sobre crema.
- Sombras suaves y difusas en café, nunca duras.

## Colors

Tierra andina: cafés profundos, óxido y ocre del tejido, crema de papel y un único verde funcional para el pedido.

### Primary
- **Verde WhatsApp** (verde-whatsapp): fondo de todo botón que abre un chat de WhatsApp para pedir. Al pasar el cursor oscurece a verde-whatsapp-hondo. Es la única superficie verde saturada de la página.

### Secondary
- **Óxido de Teja** (oxido): énfasis dentro de titulares (`em` sin cursiva en h1 y en el lema de cierre), íconos de los datos y del acordeón de preguntas.
- **Óxido Hondo** (oxido-hondo): enlaces de texto sobre crema («Mira cómo funciona», enlaces dentro de respuestas), donde el óxido normal no alcanza contraste de texto.

### Tertiary
- **Ocre de Awayo** (ocre): acentos sobre café: precio, íconos de la lista de compra y de las fichas, anillo del marcador de paso, contorno de foco y selección de texto.
- **Verde Maíz** (verde-maiz): solo dentro del rombo del awayo y en las ilustraciones; no se usa como color de interfaz.

### Neutral
- **Café Andino** (cafe): titulares sobre crema, fondo del bloque de compra, fondo de marcadores e íconos.
- **Noche** (noche): fondo de la página bajo fondo.webp, `theme-color` y la barra fija del celular (al 96 %).
- **Crema de Tela** (crema): superficie principal de contenido; texto sobre café.
- **Crema Clara** (crema-clara): fondo de los datos en píldora y del aviso de Telegram (al 97 %).
- **Crema Tenue** (crema-tenue): texto secundario sobre café (precio tachado, garantía, pie).
- **Costura** (costura): bordes punteados de listas y preguntas.
- **Tinta** (tinta): color base del texto del body.
- **Texto Cuerpo** (texto-cuerpo): párrafos y bajadas sobre crema.
- **Suave** (suave): metadatos pequeños (cabecera del aviso de Telegram).

### Named Rules
**The Un Solo Verde Rule.** El verde WhatsApp significa «pedir por WhatsApp» y nada más; si un botón no abre WhatsApp, no es verde.
**The Ocre Sobre Café Rule.** Sobre café, el acento es ocre; sobre crema, es óxido. No se invierten.

## Typography

**Display Font:** DynaPuff (con Fredoka, cursive)
**Body Font:** Fredoka (con system-ui, -apple-system, Segoe UI, Roboto, sans-serif)

**Character:** DynaPuff es redonda, inflada y juguetona, como una placa de mascota; Fredoka la acompaña con la misma redondez pero legible a tamaño de lectura. Ambas se cargan de Google Fonts (DynaPuff 600/800, Fredoka 400/500/600).

### Hierarchy
- **Display** (DynaPuff 800, clamp 30–58 px, 1.1): solo el titular principal de la portada. Una palabra clave puede ir en óxido.
- **Headline** (DynaPuff 800, clamp 26–40 px, 1.2): títulos de sección; las escenas usan clamp 25–38 px, el video y las preguntas clamp 24–36 px. Precio (40 px, ocre) y lema de cierre (clamp 26–46 px) usan la misma voz.
- **Title** (Fredoka 600, 19 px): títulos de ítems de lista; las preguntas del acordeón van en 18 px.
- **Body** (Fredoka 400, 18 px, 1.5, máx. 36em): párrafos de escena; la bajada de portada usa clamp 17–20 px a 1.45; respuestas y lista de compra 17 px; descripciones de ítems 16 px.
- **Label** (Fredoka 500, 14–15 px): datos en píldora, enlace de navegación, pie, metadatos.

### Named Rules
**The Titular Redondo Rule.** DynaPuff solo en titulares, precio y lema; nunca en párrafos, botones ni etiquetas.
**The Interlineado Honesto Rule.** El interlineado ajustado (1.1–1.2) es exclusivo de DynaPuff en display; el texto corrido no baja de 1.45.

## Layout

Una columna en celular con márgenes laterales de 20 px; a partir de 860 px la tela se abre a 48 px de margen y a dos columnas. Contenedor máximo de 1120 px centrado para cabecera, tela y pie.

- **Escenas:** imagen a sangre arriba y texto debajo en celular; en computadora grilla 1.3fr / 1fr con imagen y texto alternando lado en cada escena par. Portada 1.25fr / 1fr con la imagen a toda la altura (mín. 360 px).
- **Proporciones de imagen:** 4:3 en celular y 16:9 en computadora (la escena del aviso: 1:1 en celular, 4:3 en computadora). Cada escena sirve un archivo `-celular` y uno `-ancho` con `<picture>`.
- **Ritmo:** relleno de texto 20 px laterales y 26–32 px abajo; secciones con 30–34 px arriba; en computadora 30–40 px.
- **Acciones:** en celular el botón de pedido ocupa todo el ancho y el enlace secundario va debajo; en computadora quedan en fila.
- **Barra fija:** en celular aparece abajo solo cuando ya pasó el botón de la portada y ningún otro botón de pedido está a la vista; desaparece en computadora.
- Respeta `env(safe-area-inset-bottom)` en el pie y la barra.

## Elevation & Depth

Profundidad por capas de material, no por tarjetas flotantes: fondo ilustrado, tela crema encima, y solo unos pocos objetos levantados (botón de pedido, aviso de Telegram, video). Las sombras son suaves, difusas, con dispersión negativa y teñidas de café.

### Shadow Vocabulary
- **Tela** (`box-shadow: 0 30px 60px -30px rgba(0,0,0,.7)`): la hoja crema sobre el fondo.
- **Objeto** (`box-shadow: 0 14px 30px -14px rgba(43,29,26,.55)`, variable `--sombra`): video y elementos apoyados en la tela.
- **Botón** (`box-shadow: 0 10px 20px -12px rgba(43,29,26,.55)`): botón de pedido en reposo; en hover sube 1 px y se abre a `0 14px 24px -12px`.
- **Aviso** (`box-shadow: 0 22px 40px -16px rgba(43,29,26,.6), 0 0 0 1px rgba(59,36,32,.08)`): la notificación sobre la ilustración.
- **Insignia** (`filter: drop-shadow(0 6px 10px rgba(0,0,0,.4))`): logo con alas sobre el fondo oscuro.

### Named Rules
**The Sombra Café Rule.** Toda sombra es difusa, con dispersión negativa y tinte café o negro translúcido; ninguna sombra dura desplazada.

## Shapes

Formas blandas, de juguete y de tela. Píldoras (999 px) para navegación y datos; 18 px en botones y video; 20 px en el aviso; 14 px en los íconos cuadrados de ficha; círculos para los marcadores de paso. La tela solo redondea sus esquinas superiores (26 px) y cae recta al pie. Los bordes son de 1.5 px, punteados en color costura cuando separan ítems (como hilvanes), y sólidos translúcidos en la píldora de navegación. El awayo es un patrón SVG de 28×12 (rombos óxido y verde maíz, filetes ocre sobre café) repetido en horizontal.

## Components

### Buttons
Grandes, blandos y seguros: hechos para un pulgar en la calle.
- **Shape:** esquinas suaves (18 px).
- **Primary (pedir):** verde WhatsApp con texto blanco Fredoka 600 de 19 px, ícono de WhatsApp de 24 px, alto mínimo 56 px (52 px en la barra fija). Siempre es un enlace `wa.me` con mensaje escrito.
- **Hover / Focus:** sube 1 px, abre la sombra y oscurece a verde hondo (0.18 s, `cubic-bezier(.2,.8,.2,1)`); al presionar baja 1 px. Foco global: contorno ocre de 3 px con separación de 3 px.
- **Secundario:** enlace de texto subrayado en óxido hondo, Fredoka 600 16 px, alto 48 px, con chevron.

### Chips (datos)
- **Style:** píldora crema clara con borde punteado de 1.5 px, texto café Fredoka 500 14 px, ícono en óxido.
- **State:** informativos, sin interacción.

### Cards / Containers
- **Corner Style:** la tela (26 px arriba); el bloque de compra va a sangre sin esquinas.
- **Background:** crema para el contenido; café para el bloque de compra, cerrado arriba y abajo por franjas de awayo.
- **Shadow Strategy:** ver Elevation & Depth.
- **Internal Padding:** 20 px en celular, 40–48 px en computadora.

### Navigation
- **Style:** cabecera fuera de la tela: insignia con alas a la izquierda (168 px, 220 px en computadora) y una sola píldora «Mis mascotas» en crema con borde crema al 35 %, alto 44 px; en hover se llena de crema al 10 %.

### Franja de awayo (firma)
Separador horizontal de 14 px con el patrón `--awayo`, decorativo (`aria-hidden`). Va entre la portada y la historia, entre escenas, alrededor del bloque de compra y antes del cierre.

### Marcador de paso
Círculo café de 44 px con número crema de 21 px y anillo ocre de 3 px, en línea con el título de cada escena.

### Lista de ficha
Filas con ícono en cuadro café redondeado (46 px, ícono ocre) y texto; separadas por hilván punteado. Dos columnas en computadora.

### Aviso de Telegram (firma)
Maqueta de notificación en crema clara al 97 %, 20 px de radio, con cabecera de la app en 13 px (ícono `#229ed9`, ubicación `#1d6fa5`; esos azules son de la maqueta y no salen de ella). En celular se superpone al pie de la ilustración (−54 px); en computadora se posa sobre la pantalla bloqueada dibujada, inclinado 3°. Entra una sola vez al aparecer la escena: de 34 px abajo, escala .96 y desenfoque 6 px a reposo (0.9 s, `cubic-bezier(.16,1,.3,1)`). Con movimiento reducido o sin JavaScript queda visible y quieto.

### Precio
Cifra en DynaPuff 800 de 40 px en ocre, precio anterior tachado en Fredoka 500 21 px crema tenue, separados de la lista por un hilván ocre al 60 %.

### Preguntas (acordeón)
`details` nativos con hilván punteado, pregunta en Fredoka 600 18 px café y chevron óxido que gira 180° al abrir (0.25 s).

## Do's and Don'ts

### Do:
- **Do** poner todo el contenido sobre la tela crema y separar sus partes con franjas de awayo de 14 px.
- **Do** usar las ilustraciones del comercial a sangre, con un recorte para celular (4:3) y otro para computadora (16:9).
- **Do** mantener cada botón de pedido verde WhatsApp, de al menos 52–56 px de alto y a todo el ancho en celular.
- **Do** separar ítems de lista con bordes punteados de 1.5 px en color costura.
- **Do** usar ocre como acento sobre café y óxido como acento sobre crema.
- **Do** dejar que cada animación respete `prefers-reduced-motion` y que la página funcione completa sin JavaScript.
- **Do** tomar los íconos del subconjunto de Font Awesome en `vendor/iconos/` (se regenera con `herramientas/iconos.py`).

### Don't:
- **Don't** usar verde WhatsApp para acciones que no abren WhatsApp.
- **Don't** usar DynaPuff en párrafos, botones o etiquetas.
- **Don't** poner sombras duras desplazadas; las sombras de Kutimuy son difusas y teñidas de café.
- **Don't** poner etiquetas pequeñas en mayúsculas sobre los titulares; el titular abre la sección solo.
- **Don't** sacar los azules de Telegram de la maqueta del aviso.
- **Don't** reemplazar las ilustraciones del comercial con fotos de stock o ilustraciones de otro estilo.
