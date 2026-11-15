import tsparser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["main.js", "node_modules/**", "scripts/**", "tools/**", "esbuild.config.mjs", "eslint.config.mjs", "vitest.config.mts"]),
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			// The declarative settings API does not exist below minAppVersion 1.13, so display()
			// is the correct implementation here.
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
		},
	},
	{
		// Tests are plain Node modules: they never touch the Obsidian runtime.
		files: ["tests/**/*.ts"],
		rules: {
			"obsidianmd/prefer-active-doc": "off",
			"obsidianmd/no-global-this": "off",
		},
	},
]);
