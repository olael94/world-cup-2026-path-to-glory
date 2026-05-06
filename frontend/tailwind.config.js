module.exports = {
    content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                pitch: "#07100e",
                panel: "#111a18",
                line: "#263631",
                gold: "#f3c969",
                mint: "#71e5b7",
                coral: "#ff7d6e",
            },
            boxShadow: {
                power: "0 0 0 1px rgba(113,229,183,.55), 0 0 34px rgba(113,229,183,.28)",
            },
        },
    },
    plugins: [],
};
