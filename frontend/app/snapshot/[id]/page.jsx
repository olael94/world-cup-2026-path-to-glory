"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { RoundOf32, WildcardTable } from "../../../components/Bracket";
import { GroupBoard } from "../../../components/GroupBoard";
import { Footer } from "../../../components/Footer";
import { fetchSnapshot } from "../../../lib/api";

export default function SnapshotPage({ params: paramsPromise }) {
    const params = use(paramsPromise);
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSnapshot(params.id)
            .then(setSnapshot)
            .catch((err) => setError(err.message ?? "This prediction could not be found."))
            .finally(() => setLoading(false));
    }, [params.id]);

    const resultsByGroup = useMemo(
        () => new Map(snapshot?.groups?.map((g) => [g.group, g]) ?? []),
        [snapshot]
    );

    // Build minimal order objects from standings so GroupBoard can render read-only.
    const orders = useMemo(() => {
        if (!snapshot?.groups) return [];
        return snapshot.groups.map((g) => ({
            group: g.group,
            slots: (g.standings ?? []).map((s) => ({
                position: s.position,
                team: { id: s.teamId, name: s.teamName, group: g.group, ranking: 0 },
            })),
        }));
    }, [snapshot]);

    const formattedDate = snapshot?.createdAt
        ? new Date(snapshot.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

    return (
        <main className="min-h-screen">
            <header className="mx-auto max-w-[1400px] px-8 py-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white/80"
                >
                    <ArrowLeft size={15} /> Build your own prediction
                </Link>

                <div className="mt-6">
                    <p className="section-kicker">Saved Prediction</p>
                    <h1 className="mt-1 text-3xl font-black text-white">
                        {snapshot?.snapshotName ?? "Path to Glory Prediction"}
                    </h1>
                    {formattedDate && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/40">
                            <CalendarDays size={13} /> {formattedDate}
                        </p>
                    )}
                </div>
            </header>

            {loading && (
                <div className="mx-auto max-w-[1400px] px-8 py-20 text-center text-white/40">
                    Loading prediction…
                </div>
            )}

            {error && (
                <div className="mx-auto max-w-[1400px] px-8 py-20 text-center">
                    <p className="text-white/50">{error}</p>
                    <Link
                        href="/"
                        className="mt-4 inline-flex items-center gap-2 text-sm text-mint hover:underline"
                    >
                        <ArrowLeft size={14} /> Go back and build a prediction
                    </Link>
                </div>
            )}

            {snapshot && (
                <>
                    <section className="groups-section mx-auto grid max-w-[1400px] gap-5 px-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {orders.map((order) => (
                            <GroupBoard
                                key={order.group}
                                order={order}
                                result={resultsByGroup.get(order.group)}
                                onDropTeam={() => {}}
                                onIntelClick={() => {}}
                            />
                        ))}
                    </section>

                    {snapshot.wildcardTable?.length ? (
                        <WildcardTable rows={snapshot.wildcardTable} />
                    ) : null}

                    {snapshot.roundOf32?.length ? (
                        <RoundOf32
                            fixtures={snapshot.roundOf32}
                            mode="simulation"
                            momentumByTeam={Object.fromEntries(
                                snapshot.groups
                                    ?.flatMap((g) => g.standings ?? [])
                                    .map((s) => [s.teamName, s.momentumShift]) ?? []
                            )}
                            eloByTeam={Object.fromEntries(
                                snapshot.groups
                                    ?.flatMap((g) => g.standings ?? [])
                                    .map((s) => [s.teamName, s.elo]) ?? []
                            )}
                        />
                    ) : null}
                </>
            )}

            <Footer />
        </main>
    );
}
