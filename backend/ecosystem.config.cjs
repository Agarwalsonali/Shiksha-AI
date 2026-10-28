module.exports = {
  apps: [
    {
      name: 'shiksha-api',
      script: 'src/index.ts',
      interpreter: '/home/ubuntu/.bun/bin/bun',
      cwd: '/home/ubuntu/shiksha-ai/backend',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
      // Restart settings
      max_restarts: 10,
      min_uptime: '10s',
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Watch (disable in production)
      watch: false,
    },
  ],
};
