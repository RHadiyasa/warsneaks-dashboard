import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
export default [
  { ignores:["**/node_modules/**","**/.next/**","**/next-env.d.ts","spy-meta-ads-library-v2.9.3 (versi Terbaru)/**"] },
  js.configs.recommended,
  { files:["**/*.ts","**/*.tsx"], languageOptions:{parser:tsParser,parserOptions:{ecmaVersion:"latest",sourceType:"module",ecmaFeatures:{jsx:true}}}, plugins:{"@typescript-eslint":tsPlugin}, rules:{...tsPlugin.configs.recommended.rules,"no-undef":"off","@typescript-eslint/no-explicit-any":"error"} }
];