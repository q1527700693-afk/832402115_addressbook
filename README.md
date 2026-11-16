# 拾光通讯录 · Shiguang Address Book

A small, focused address book for the Software Engineering (FZU–MU) Extreme
Programming assignment. It keeps the people you contact often one click away,
stores as many contact methods as you need for each person, and moves data in
and out through Excel.

![Main interface](docs/images/main.png)

## Features

| Requirement | Implementation |
| --- | --- |
| Bookmark contacts | A star button in each contact file, a pinned **收藏** filter in the sidebar, favorite-first sorting and an empty state for the favorite list. Toggling is optimistic and persisted immediately. |
| Multiple contact methods | Every contact owns an ordered list of methods: phone, email, WeChat, QQ, address and other. Each method has its own label (for example “公司” or “个人”), and the editor can add or remove rows freely. |
| Excel export | One row per contact, one column per information type (`手机1`, `手机2`, `邮箱1`, `微信`, `地址`, …). Styled header, frozen panes, filters and sensible row heights. |
| Excel import | Reads `.xlsx`/`.xlsm` files, maps the Chinese or English headers, validates every row, reports row-level errors, and can merge duplicates or skip them. |
| Page style | A warm paper-like interface with responsive layouts for desktop and mobile, keyboard shortcuts, accessible controls and reduced-motion support. |
| Deployment | Node.js + Express + SQLite behind Nginx, process-managed with PM2. |

## Tech stack

- **Frontend** — semantic HTML, hand-written CSS (no framework), native ES
  modules. No build step: the server serves `public/` directly.
- **Backend** — Node.js 22.5+, Express 4, built-in `node:sqlite`, `exceljs` for
  workbook generation/parsing, `multer` for in-memory uploads.
- **Database** — SQLite in WAL mode, two tables (`contacts`,
  `contact_methods`), foreign keys with cascade delete.
- **Tests** — `node:test` against an in-memory database, including a real Excel
  round trip through multipart upload.

## Quick start

Requirements: Node.js **22.5+** (the project uses the built-in `node:sqlite`
module). The reference environment is Node.js 24.

```bash
npm install
npm run seed     # optional: load 12 demo contacts
npm start        # http://localhost:3000
```

For development with automatic restarts:

```bash
npm run dev
```

Run the API tests:

```bash
npm test
```

The database file is created at `data/addressbook.db`. Set `DB_PATH` to use a
different location and `PORT` to change the HTTP port.

## Excel format

The import template is available in the running app from **导入 Excel → 下载导入模板**.

| 姓名 | 公司 | 职位 | 生日 | 标签 | 收藏 | 手机1 | 手机2 | 手机3 | 邮箱1 | 邮箱2 | 微信 | QQ | 地址 | 其他 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 罗峰 | 极限武馆 | 战神 | 1995-08-15 | 战神、兄弟 | 是 | 13800001301 | | | luofeng@example.com | | luofeng_jx | | 江南基地市扬州城明月小区 8 栋 | | 示例行 |

- `姓名` is required; every other column is optional.
- `收藏` accepts `是/否`, `yes/no`, `true/false` or `1/0`.
- Multiple values inside one phone or email cell can be separated with `;`, `；`,
  a newline or ` / `.
- Extra phones beyond `手机3` and emails beyond `邮箱2` are folded into the last
  column of that type, separated by ` / `, so no data is lost on export.
- Supported files: `.xlsx` and `.xlsm`, up to 8 MB and 2,000 data rows. Legacy
  `.xls` files should be saved as `.xlsx` first.
- Import modes: **合并更新** updates a contact when both the name and a phone or
  email match; **跳过重复** leaves it untouched. Bad rows are reported with their
  row number and do not block the other rows.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/contacts?q=&favorite=1` | List and search contacts |
| `GET` | `/api/contacts/:id` | Read one contact |
| `POST` | `/api/contacts` | Create a contact with methods |
| `PUT` | `/api/contacts/:id` | Replace a contact and its methods |
| `PATCH` | `/api/contacts/:id/favorite` | Toggle the favorite flag |
| `DELETE` | `/api/contacts/:id` | Delete a contact |
| `GET` | `/api/export` | Download all contacts as `.xlsx` |
| `GET` | `/api/import/template` | Download the import template |
| `POST` | `/api/import` | Multipart upload (`file`, `mode=merge\|skip`) |

Errors use the shape `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
with a matching HTTP status.

## Project structure

```text
addressbook-assignment/
├── public/                 browser application (no build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/{api,app,icons}.js
├── server/
│   ├── app.js              Express app factory
│   ├── index.js            HTTP entry point
│   ├── db.js               SQLite connection and schema
│   ├── store.js            validation and persistence
│   ├── excel.js            workbook build/parse and header mapping
│   ├── seed.js             demo data
│   └── routes/{contacts,excel}.js
├── test/api.test.js        API + Excel round-trip tests
├── deploy/                 Nginx, PM2 and systemd examples
├── docs/                   assignment blog and screenshots
├── codestyle.md
└── package.json
```

## Screenshots

| Contact file | Excel export |
| --- | --- |
| ![Contact file](docs/images/main.png) | ![Excel export](docs/images/excel-export.png) |

| Import result | Mobile layout |
| --- | --- |
| ![Import result](docs/images/import-result.png) | ![Mobile](docs/images/mobile.png) |

## Deployment

The application is a single Node.js process that serves both the API and the
static frontend, so a reverse proxy in front of port `3100` is enough.

```bash
npm ci --omit=dev
DB_PATH=/var/lib/addressbook/addressbook.db PORT=3100 npm start
```

Nginx (sub-path example, keeps the existing site at `/`):

```nginx
location = /addressbook { return 301 /addressbook/; }
location /addressbook/ {
    proxy_pass http://127.0.0.1:3100/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 10m;
}
```

Example PM2 and systemd units live in [`deploy/`](deploy/). The frontend uses
relative API URLs, so it works at the domain root and under a sub-path without
a rebuild.

## License

MIT
