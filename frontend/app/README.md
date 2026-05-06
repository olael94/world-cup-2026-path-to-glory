# app/

Next.js App Router entry points.

| File | Description |
|---|---|
| `layout.jsx` | Root layout — sets HTML lang, loads `globals.css`, and defines site metadata |
| `page.jsx` | Main page and simulation hub. Owns all top-level state (orders, discipline, snapshot, focused groups, manual scores) and wires the full simulation flow from group drag-ordering through to the knockout bracket |
| `globals.css` | Global styles — Tailwind directives, custom fonts, CSS custom properties, and all BEM-style class definitions used across components |
