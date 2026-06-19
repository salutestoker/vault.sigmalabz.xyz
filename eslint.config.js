import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    {
        ignores: [
            'bootstrap/cache/**',
            'node_modules/**',
            'public/build/**',
            'storage/**',
            'vendor/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['resources/js/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                route: 'readonly',
            },
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier: prettierPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            'react/no-unescaped-entities': 'off',
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
];
