import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Cross-route-group import boundaries (Story 1.7):
 * Files in one role's route group must not import from another role's group.
 * Shared concerns live in components/, hooks/, or lib/.
 */
const groupBoundaryRule = (group, forbidden) => ({
  files: [`src/app/(${group})/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: forbidden.map((other) => ({
          group: [
            `@/app/(${other})/**`,
            `src/app/(${other})/**`,
            `**/app/(${other})/**`,
          ],
          message: `(${group}) route group must not import from (${other}). Lift shared code to components/, hooks/, or lib/.`,
        })),
      },
    ],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  groupBoundaryRule("alumni", ["employer", "admin"]),
  groupBoundaryRule("employer", ["alumni", "admin"]),
  groupBoundaryRule("admin", ["alumni", "employer"]),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
