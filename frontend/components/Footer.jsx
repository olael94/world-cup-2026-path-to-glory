import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="site-footer mx-auto max-w-[1400px] px-8 py-8 mt-8">
            <div className="site-footer-inner">
                <div className="site-footer-left">
                    <span className="site-footer-title">Path to Glory</span>
                    <span className="site-footer-divider" aria-hidden="true" />
                    <span className="site-footer-copy">© 2026 Oliver Rivera</span>
                </div>
                <p className="site-footer-disclaimer">
                    An unofficial fan-made World Cup 2026 simulator. Not affiliated with or endorsed
                    by FIFA.
                </p>
                <a
                    href="https://github.com/olael94/world-cup-2026-path-to-glory/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-footer-github"
                    aria-label="Report an issue on GitHub"
                >
                    <Github size={14} />
                    Report an issue
                </a>
            </div>
        </footer>
    );
}
