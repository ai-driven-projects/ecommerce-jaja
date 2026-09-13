import type { Config } from "jest";

const config: Config = {
	verbose: true,
	preset: "ts-jest",
	testMatch: ["**/test/**/*.test.ts"],
	moduleNameMapper: {
		"^__SHARED_PACKAGE_NAME__$": "<rootDir>/../../packages/shared/dist",
		"^__SHARED_PACKAGE_NAME__/(.*)$": "<rootDir>/../../packages/shared/dist/$1",
		"^__AUTH_PACKAGE_NAME__$": "<rootDir>/../../modules/auth/dist",
		"^__AUTH_PACKAGE_NAME__/(.*)$": "<rootDir>/../../modules/auth/dist/$1",
		"^@pharmacore/product$": "<rootDir>/../../modules/product/dist",
		"^@pharmacore/product/(.*)$": "<rootDir>/../../modules/product/dist/$1",
		"^@pharmacore/branch$": "<rootDir>/../../modules/branch/dist",
		"^@pharmacore/branch/(.*)$": "<rootDir>/../../modules/branch/dist/$1",
	},
};

export default config;
