# 拾光通讯录 · Code Standard

This project follows the general conventions below. They are adapted from the
Google HTML/CSS Style Guide, the Google JavaScript Style Guide and the Airbnb
JavaScript Style Guide. When a rule and readability conflict, readability wins,
but the exception must stay consistent inside a file.

References:

- Google HTML/CSS Style Guide — https://google.github.io/styleguide/htmlcssguide.html
- Google JavaScript Style Guide — https://google.github.io/styleguide/jsguide.html
- Airbnb JavaScript Style Guide — https://github.com/airbnb/javascript

## 1. Repository layout

- `public/` contains the browser application. It must stay build-free: plain
  HTML, CSS and ES modules that any static server can host.
- `server/` contains the Node.js application. Routes, persistence and Excel
  handling live in separate modules.
- `test/` contains Node.js API tests.
- `docs/` contains the assignment blog and screenshots.

## 2. HTML

1. Use lowercase element and attribute names, and always quote attribute values.
2. Use semantic landmarks (`aside`, `main`, `header`, `section`, `footer`).
3. Every icon-only button needs an `aria-label`; every input needs a label.
4. Keep markup free of inline event handlers (`onclick` and friends).
5. Indent with two spaces.

## 3. CSS

1. Use lowercase kebab-case class names, for example `contact-card` or
   `method-row`.
2. Design tokens (colors, radii, shadows, fonts) are declared once in `:root`.
3. Layout uses flexbox and CSS grid; avoid absolute positioning for page flow.
4. Component styles are grouped with a comment banner.
5. Prefer `rem`/`px` values from the existing spacing rhythm; avoid magic
   numbers that are not explained by the surrounding layout.
6. Every animation must respect `prefers-reduced-motion`.

## 4. JavaScript

1. ES modules only (`import` / `export`), no global namespace objects.
2. Two-space indentation, semicolons, single quotes, trailing commas in
   multi-line literals.
3. `camelCase` for variables and functions, `PascalCase` for classes,
   `SCREAMING_SNAKE_CASE` for module-level constants.
4. Prefer `const`; use `let` only when reassignment is required.
5. Never use `eval`, `new Function` or string-built HTML containing unescaped
   user input. User-controlled values go through `escapeHtml`/`esc` before they
   are inserted with `innerHTML`.
6. Separate data access (`api.js`) from rendering and event handling (`app.js`).
7. Async functions must handle failures; user-visible failures become a toast,
   never a silent `catch`.
8. Validate on the client for fast feedback and again on the server; the server
   is the source of truth.

## 5. Node.js and HTTP

1. Use the built-in `node:sqlite` driver; no native build step is required.
2. Routes only translate HTTP to service calls. Validation and SQL live in
   `store.js`.
3. All mutating SQL that touches more than one table runs inside a transaction.
4. Return JSON errors as `{ "error": { "code", "message" } }` with an appropriate
   HTTP status code.
5. Never interpolate user input into SQL. Use prepared statements.
6. Uploads are limited to 8 MB and to `.xlsx`/`.xlsm` files, and are parsed in
   memory.

## 6. Git

1. Commit messages follow `type(scope): summary`, for example
   `feat(api): add Excel import endpoint`.
2. One commit contains one logical change; generated files, databases and
   `node_modules/` are never committed.
3. `npm test` must pass before a commit is pushed.
