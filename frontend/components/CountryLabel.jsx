import Image from "next/image";
import { teamByName } from "../lib/seedData";

export function CountryLabel({ name, className = "" }) {
    const team = teamByName[name];

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

export function FlagMark({ team, size = "sm" }) {
    const dimensions =
        size === "xs"
            ? "h-3.5 w-5 text-base"
            : size === "lg"
              ? "h-10 w-10 text-3xl"
              : "h-5 w-7 text-xl";

    return (
        <span
            className={`relative inline-grid shrink-0 place-items-center overflow-hidden leading-none ${dimensions}`}
            aria-hidden="true"
        >
            {team.flagImage ? (
                <Image fill src={team.flagImage} alt="" className="object-contain drop-shadow" />
            ) : (
                team.flag
            )}
        </span>
    );
}
