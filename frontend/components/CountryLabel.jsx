import Image from "next/image";
import { teamByName } from "../lib/seedData";

// Displays a team's flag and name together.
// Used anywhere a team name appears — group boards, bracket cards, wildcard table.
export function CountryLabel({ name, className = "" }) {
    const team = teamByName[name];

    // If the name isn't a known team (e.g. "TBD" or "Pending"), just show the text.
    if (!team) {
        return <span className={className}>{name}</span>;
    }

    return (
        <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
            <FlagMark team={team} />
            <span className="truncate">{name}</span>
        </span>
    );
}

// Renders just the flag image (or emoji fallback) at a given size.
// Exported separately so other components can show a flag without the team name.
export function FlagMark({ team, size = "sm" }) {
    // Three preset sizes: xs (tiny inline), sm (default), lg (large card view).
    const dimensions =
        size === "xs"
            ? "h-3.5 w-5 text-base"
            : size === "lg"
              ? "h-10 w-10 text-3xl"
              : "h-5 w-7 text-xl";

    return (
        // aria-hidden hides the flag from screen readers — the team name next to it
        // already describes the team, so reading out the flag image would be redundant.
        <span
            className={`relative inline-grid shrink-0 place-items-center overflow-hidden leading-none ${dimensions}`}
            aria-hidden="true"
        >
            {/* Use the optimised Next.js Image if a flag image path exists,
                otherwise fall back to the emoji flag stored on the team object. */}
            {team.flagImage ? (
                <Image fill src={team.flagImage} alt="" className="object-contain drop-shadow" />
            ) : (
                team.flag
            )}
        </span>
    );
}
