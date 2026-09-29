import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './owners/*.ts',
  out: './migrations',
});
