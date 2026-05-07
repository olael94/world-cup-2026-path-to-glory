import "./globals.css";

export const metadata = {
    title: "Path to Glory",
    description:
        "2026 FIFA World Cup simulator that lets fans drag-and-drop group predictions, manipulate match scores, and calculate the full bracket using AI-powered team intelligence. Share your prediction with a single link.",
    icons: {
        icon: "/icon.svg",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
