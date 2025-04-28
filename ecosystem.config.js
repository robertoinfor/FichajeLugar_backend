// ecosystem.config.js
module.exports = {
  apps: [
    {
      name   : 'api-empresa',
      script : './index.js',
      env: {
        NODE_ENV   : 'development',
        PORT_HTTPS : 8443
      },
      env_production: {
        NODE_ENV   : 'production',
        PORT_HTTPS : 443
      }
    }
  ]
};
