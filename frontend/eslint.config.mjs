import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
    ...nextConfig,
    {
        rules: {
            // Allow unused vars/params prefixed with _ (intentionally ignored)
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
];

export default config;
