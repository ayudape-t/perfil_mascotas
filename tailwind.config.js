/**
 * Estilos Tailwind de registro.html, vet.html y recuperar.html (antes venían del CDN, que los armaba en cada visita).
 * Si agregas clases de Tailwind nuevas en esas páginas, regenera tailwind.css con la CLI independiente v3.4.17:
 *   https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17  (tailwindcss-windows-x64.exe / -linux-x64 / -macos-arm64)
 *   printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > entrada.css
 *   ./tailwindcss-linux-x64 -c tailwind.config.js -i entrada.css -o tailwind.css --minify
 */
module.exports = {
  content: ['./registro.html', './vet.html', './recuperar.html'],
  theme: { extend: {} },
  plugins: [],
};
