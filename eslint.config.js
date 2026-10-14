const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/", ".adminjs/", "coverage/", "prisma/migrations/"] },

  js.configs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Express handlers often take (req, res, next) without using all three.
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
    },
  },

  {
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.jest } },
  },

  // AdminJS custom components are ESM + JSX and run in the browser.
  {
    files: ["src/admin/components/**/*.jsx"],
    plugins: { react },
    languageOptions: {
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },

  // Must be last: turns off rules that conflict with Prettier.
  prettier,
];