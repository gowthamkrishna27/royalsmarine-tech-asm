module.exports = {
  apps: [
    {
      name: 'rupa-crm-api',
      script: 'src/server.js',
      cwd: '/var/www/rupa-crm/backend',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/www/rupa-crm/logs/pm2-error.log',
      out_file: '/var/www/rupa-crm/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
