"use client";

import { useState, useTransition } from "react";
import { executeRaffleRoundAction } from "@/app/telao/sorteio/[eventId]/actions";
import type { RaffleRoundResult } from "@/lib/raffles/draw";

type RaffleStageProps = {
  eventId: string;
  eventDayId: string;
  eventName: string;
  displayName: string;
  eventDate: string;
  eventLogoUrl: string | null;
  sponsorBannerUrl: string | null;
};

type Stage = "setup" | "countdown" | "drawing" | "result";

const COUNTDOWN_SECONDS = 2;

function formatWinnerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function RaffleStage({
  eventId,
  eventDayId,
  eventName,
  displayName,
  eventDate,
  eventLogoUrl,
  sponsorBannerUrl,
}: RaffleStageProps) {
  const [stage, setStage] = useState<Stage>("setup");
  const [winnersCount, setWinnersCount] = useState(1);
  const [includePreviousWinners, setIncludePreviousWinners] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [result, setResult] = useState<RaffleRoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function waitForCountdown() {
    return new Promise<void>((resolve) => {
      let nextCount = COUNTDOWN_SECONDS;
      const timer = window.setInterval(() => {
        nextCount -= 1;
        if (nextCount <= 0) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        setCountdown(nextCount);
      }, 1000);
    });
  }

  function runDraw() {
    setError(null);
    setResult(null);
    setCountdown(COUNTDOWN_SECONDS);
    setStage("countdown");

    startTransition(async () => {
      const drawPromise = executeRaffleRoundAction({
        eventId,
        eventDayId,
        winnersCount,
        includePreviousWinners,
      });
      await waitForCountdown();
      setStage("drawing");
      const response = await drawPromise;

      if (!response.ok) {
        setError(response.error);
        setStage("setup");
        return;
      }

      setResult(response.result);
      setStage("result");
    });
  }

  function resetRound() {
    setError(null);
    setResult(null);
    setStage("setup");
  }

  return (
    <main className="relative h-screen h-[100dvh] overflow-hidden bg-[#f7f9fb] p-2 text-[#191c1e] md:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,94,164,0.12),transparent_34%),radial-gradient(circle_at_88%_28%,rgba(0,106,98,0.18),transparent_38%)]" />

      <section className="relative mx-auto grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] rounded-2xl bg-white/62 p-3 shadow-[0_28px_80px_-44px_rgba(0,96,168,0.55)] backdrop-blur-sm md:p-6">
        <header className={stage === "result" ? "shrink-0" : undefined}>
          <div className={`flex items-center ${stage === "result" ? "gap-3" : "gap-4"}`}>
            {eventLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={eventLogoUrl}
                alt={`Logo ${eventName}`}
                className={stage === "result" ? "h-10 w-20 object-contain md:h-14 md:w-28" : "h-14 w-28 object-contain md:h-20 md:w-40"}
              />
            ) : null}
            <div>
              <p
                className={`font-headline font-extrabold tracking-tight text-[var(--primary)] ${
                  stage === "result" ? "text-lg md:text-2xl" : "text-2xl md:text-4xl"
                }`}
              >
                {displayName}
              </p>
              <p
                className={`font-semibold uppercase text-[var(--outline)] ${
                  stage === "result"
                    ? "text-[0.6rem] tracking-[0.12em] md:text-xs md:tracking-[0.16em]"
                    : "mt-1 text-xs tracking-[0.14em] md:text-sm md:tracking-[0.18em]"
                }`}
              >
                {eventName} | {new Date(`${eventDate}T12:00:00`).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 items-center justify-center overflow-hidden py-2 md:py-3">
          {stage === "setup" ? (
            <div className="w-full max-w-xl rounded-2xl bg-white/88 p-4 text-center shadow-[0_18px_48px_-30px_rgba(0,96,168,0.5)] md:p-5">
              <p className="font-headline text-3xl font-extrabold tracking-tight md:text-5xl">Nova rodada</p>
              <p className="mt-1 text-sm text-muted md:text-base">Escolha quantos participantes serão sorteados nesta rodada.</p>

              <label className="mt-3 block text-left text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
                Quantidade de ganhadores
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={winnersCount}
                  onChange={(event) => setWinnersCount(Math.max(1, Math.min(5, Number(event.target.value) || 1)))}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 text-center text-xl font-extrabold outline-none focus:border-[var(--primary)] md:h-12 md:text-2xl"
                />
              </label>

              <label className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-3 text-left">
                <input
                  type="checkbox"
                  checked={includePreviousWinners}
                  onChange={(event) => setIncludePreviousWinners(event.target.checked)}
                  className="h-5 w-5"
                />
                <span className="block text-sm font-bold text-[var(--foreground)]">Incluir visitantes já sorteados</span>
              </label>

              {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

              <button
                type="button"
                onClick={runDraw}
                disabled={isPending}
                className="gradient-primary mt-3 h-11 w-full rounded-xl px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 md:h-12 md:text-base"
              >
                Sortear
              </button>
            </div>
          ) : null}

          {stage === "countdown" ? (
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--outline)]">Preparando rodada</p>
              <p
                key={countdown}
                className="mt-2 animate-ping font-headline text-[clamp(6rem,24vh,14rem)] font-extrabold leading-none text-[var(--primary)]"
              >
                {countdown}
              </p>
            </div>
          ) : null}

          {stage === "drawing" ? (
            <div className="text-center">
              <p className="font-headline text-[clamp(2.5rem,7vh,4.5rem)] font-extrabold tracking-tight">Sorteando...</p>
              <p className="mt-2 text-base text-muted md:text-lg">Só mais um instante.</p>
            </div>
          ) : null}

          {stage === "result" && result ? (
            <div className="flex h-full min-h-0 w-full flex-col justify-center py-1">
              <div className="text-center">
                <h1 className="font-headline text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--secondary)] md:text-lg">
                  Ganhadores <span className="text-[var(--outline)]">• Rodada {result.roundNumber}</span>
                </h1>
              </div>

              <div className="mx-auto mt-2 flex min-h-0 w-full max-w-[1500px] flex-1 flex-col gap-1.5 md:gap-2">
                {result.winners.map((winner) => (
                  <div
                    key={winner.id}
                    className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl bg-white/92 px-3 py-1 text-center shadow-[0_14px_36px_-28px_rgba(0,96,168,0.52)] md:rounded-2xl md:px-5"
                  >
                    <p className="max-w-full whitespace-nowrap font-headline text-[clamp(1.65rem,min(5.8vh,7vw),5.25rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-[#111820]">
                      {formatWinnerName(winner.fullName)}
                    </p>
                    <p className="mt-0.5 text-[0.58rem] font-bold uppercase tracking-[0.13em] text-[var(--outline)] md:text-[0.7rem] md:tracking-[0.16em]">
                      Participante {winner.participantNumber || "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={resetRound}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-bold text-white md:px-6 md:text-sm"
                >
                  Nova rodada de sorteio
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {sponsorBannerUrl ? (
          <footer className="flex shrink-0 justify-center pt-1 md:pt-2">
            <div
              role="img"
              aria-label="Patrocinadores do evento"
              className="h-[clamp(90px,22dvh,240px)] w-full max-w-[1000px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${sponsorBannerUrl}")` }}
            />
          </footer>
        ) : null}
      </section>
    </main>
  );
}
