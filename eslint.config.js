import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'apps/web/public/preview-correo/**',
      'apps/api/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Avisar de variables sin usar, permitiendo el convenio de prefijo _
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Este proyecto usa `any` en unos pocos puntos donde Prisma no expone
      // tipos: se avisa, pero no bloquea.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Prettier el último: desactiva las reglas de estilo que chocarían con él.
  prettier,
)
