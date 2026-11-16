module.exports = {
  apps: [
    {
      name: 'addressbook',
      cwd: '/opt/addressbook',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
        DB_PATH: '/var/lib/addressbook/addressbook.db',
      },
    },
  ],
};
