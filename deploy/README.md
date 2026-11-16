# Deployment

The app is one Node.js process: Express serves `/api/*` and the static files in
`public/`. SQLite and the uploaded workbook parsing need no extra services.

## 1. Prepare the directory

```bash
sudo mkdir -p /opt/addressbook /var/lib/addressbook
sudo chown -R $USER:$USER /opt/addressbook /var/lib/addressbook
cd /opt/addressbook
git clone https://github.com/q1527700693-afk/832402115_addressbook.git .
npm ci --omit=dev
```

`.env` is not required; environment variables are passed by PM2 or systemd.

## 2. Run with PM2

```bash
sudo npm install -g pm2
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup            # follow the printed command
```

Check:

```bash
curl -s http://127.0.0.1:3100/api/health
```

## 3. Nginx sub-path

Add the snippet from `deploy/nginx/addressbook-subpath.conf.example` inside the
existing `:80` server block, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The public URL becomes `http://<server>/addressbook/`. The frontend resolves API
URLs relative to the page, so no rebuild or base-path configuration is needed.

## 4. Security notes

- Only ports 80/443 need to be public; port 3100 stays on localhost.
- The app has no login because the assignment is a personal address book. If it
  is exposed publicly, put it behind Nginx basic auth or restrict the security
  group to the campus network.
- Back up `/var/lib/addressbook/addressbook.db` (and the `-wal`/`-shm` files
  when the service is stopped).
