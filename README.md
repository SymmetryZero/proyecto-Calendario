# Flujo Pro

PWA para la gestión de flujos de trabajo construida con Next.js, React, Tailwind CSS y Zustand, con persistencia local en `localStorage`.

## Incluye

- Tablero Kanban con arrastrar y soltar, avatares y temporizador persistente.
- Vista de evidencias con carga de fotos y videos como Base64.
- Pizarra técnica propia en SVG con trazos libres, texto, líneas, selección y deshacer/rehacer.
- Vista de asignación de requerimientos y técnicos.
- Modal de guardado con carpetas nuevas o existentes.
- Persistencia completa en `localStorage` mediante `persist` de Zustand.
- Base PWA con `manifest` y `service worker`.

## Instalación

1. Instala las dependencias:

```bash
npm install
```

2. Ejecuta el entorno de desarrollo:

```bash
npm run dev
```

3. Compila para producción:

```bash
npm run build
```

## Notas

- El almacenamiento de videos grandes puede chocar con el límite del navegador.
- Todo el estado principal se guarda localmente, sin base de datos SQL.
