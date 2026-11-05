# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dueños de perros y gatos en Huánuco (Perú)** que compran la placa, la activan en su propio celular y administran el perfil, la ficha médica y la alarma de mascota perdida.
- **Quien encuentra una mascota perdida:** escanea el QR o acerca el celular (NFC) sin instalar nada, ve el perfil y contacta a la familia o le envía su ubicación.
- **Veterinarias y veterinarios:** registran consultas con un código temporal del dueño o desde el portal de clínicas, con el acceso que el dueño acepta.
- **Responsable de Kutimuy (soporte):** activa lotes de placas, ayuda a dueños que no pueden entrar, aprueba clínicas.

## Product Purpose

Kutimuy es una placa con código QR y chip NFC para el collar que abre el perfil digital de la mascota. Ayuda a que una mascota perdida vuelva a ser contactada con su familia (sin garantizar que se recupere) y reúne su ficha de salud, recordatorios de vacunas y desparasitación, historial médico y avisos.

## Positioning

- Quien escanea no necesita app; el dueño recibe al instante un aviso por Telegram, con la ubicación si quien escanea la comparte.
- Alarma de mascota perdida con afiche «¡Se busca!», publicación en el canal comunitario de Telegram, zona aproximada en un mapa y botón para difundir por WhatsApp.
- Ficha médica con recordatorios y registro por veterinarios autorizados por el dueño.
- Hecho y vendido en persona en Huánuco, con identidad andina.

## Operating Context

- Venta presencial (casa por casa, dueño a dueño, parques, ferias, veterinarias) en Huánuco y también envíos a otras ciudades del Perú; pedidos y consultas por WhatsApp de soporte (+51 921 512 933).
- La placa viene con una tarjeta con su código de activación; el dueño activa la placa en su celular con ese código y crea un PIN de 4 dígitos.
- App instalable «Mis mascotas» (app.html) y portal de veterinarias (veterinaria.html).

## Capabilities and Constraints

- Pago único, sin mensualidades (confirmado por el dueño del producto).
- Precio (dado por el dueño): S/ 45 regular; S/ 35 «precio de lanzamiento» solo para las primeras 15 placas (límite real; nunca inventar escasez). No inventar otras cifras ni fechas.
- Garantía de 6 meses por defectos de fabricación; devolución dentro de 7 días calendario si la placa no está activada y conserva su empaque (privacidad.html, sección 13).
- Sitio estático (HTML/CSS/JS) en Cloudflare Pages; datos en Supabase; avisos por Telegram (@Ayudapetbot y canal de avisos).
- La dirección actual es helpet.pages.dev; habrá dominio propio más adelante. Las placas ya grabadas apuntan a `/?id=<código>`.

## Brand Commitments

- Nombre: **Kutimuy** («¡vuelve!» en quechua). Lema usado: «Todo lo que tu mascota necesita, en una sola placa.»
- No usar lemas que prometan que la mascota volverá.
- Activos: logo.png, kutimuy-alas.svg, og-kutimuy.jpg, iconos en icono-*.png; comercial y tutorial en video.

## Evidence on Hand

- Comercial (30 s) y tutorial en video (fuera del repositorio, entregados al dueño).
- No hay testimonios, cifras de clientes ni reseñas: no fabricarlos.

## Product Principles

- Quien encuentra a la mascota debe poder ayudar en segundos, sin instalar nada.
- El dueño decide qué se ve y quién accede; los datos sensibles nunca se exponen.
- Prometer solo lo que el producto hace hoy.
- Pensado para celulares y datos móviles.

## Accessibility & Inclusion

- Público amplio en Huánuco, incluidas personas mayores y celulares de gama baja: textos claros, contraste y botones grandes; páginas livianas.
