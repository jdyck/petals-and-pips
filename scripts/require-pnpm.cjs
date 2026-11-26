if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error('Use pnpm for this project.');
  process.exit(1);
}
