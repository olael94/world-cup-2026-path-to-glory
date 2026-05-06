import "./globals.css";

export const metadata = {
    title: "Path to Glory",
    description: "2026 World Cup tournament simulator",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
