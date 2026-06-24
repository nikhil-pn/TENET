import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Supabase Edge Functions run on Deno (remote URL imports, Deno globals) — not
  // part of the Next app's TypeScript program. Excluded from app lint/build.
  { ignores: ["supabase/functions/**"] },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
