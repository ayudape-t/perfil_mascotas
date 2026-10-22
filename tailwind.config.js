/**
 * Estilos Tailwind de registro.html y de su script js/panel.js (antes venían del CDN, que los armaba en cada visita).
 * Las demás páginas no usan Tailwind: tienen su propio CSS con el diseño andino (carpeta css/).
 * Si agregas clases de Tailwind nuevas en registro.html o js/panel.js, regenera tailwind.css con la CLI independiente v3.4.17:
 *   https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17  (tailwindcss-windows-x64.exe / -linux-x64 / -macos-arm64)
 *   printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > entrada.css
 *   ./tailwindcss-linux-x64 -c tailwind.config.js -i entrada.css -o tailwind.css --minify
 */
module.exports = {
  content: ['./registro.html', './js/panel.js'],
  theme: { extend: {} },
  plugins: [],
};
