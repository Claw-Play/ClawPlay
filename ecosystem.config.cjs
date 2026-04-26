module.exports = {
  apps: [
    {
      name: "clawplay",
      cwd: "/var/www/clawplay/web",
      script: "npm",
      args: "start",
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
