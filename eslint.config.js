import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Dead code VISÍVEL (warn): pega vars/imports não usados. `args:"none"` evita
      // ruído de params; prefixo `_` marca intencional. Era "off" (nada pegava — daí
      // dava p/ deixar helpers órfãos). Limpeza dos pendentes é incremental.
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", caughtErrors: "none" }],
      // `any` em mappers de resultado é pragmático: o Supabase infere tipos
      // frágeis em selects relacionais profundos (ex.: mesocycle:mesocycles!inner).
      // Mantemos VISÍVEL (warn) sem travar o gate de erros. Em billing/auth,
      // preferir tipos reais (ver subscription/admin/coach/analytics.functions).
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  eslintPluginPrettier,
);
