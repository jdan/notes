import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			include: ["index.ts", "server.ts"],
		},
	},
});
