"use client";

import { useState, useTransition } from "react";
import { executeRaffleRoundAction } from "@/app/telao/sorteio/[eventId]/actions";
import type { RaffleRoundResult } from "@/lib/raffles/draw";

type RaffleStageProps = {
  eventId: string;
  eventDayId: string;
  eventName: string;
  eventDate: string;
  sponsorBannerUrl: string | null;
};

type Stage = "setup" | "countdown" | "drawing" | "result";

const COUNTDOWN_SECONDS = 2;

export function RaffleStage({
  eventId,
  eventDayId,
  eventName,
  eventDate,
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

  const resultGridClass =
    result && result.winners.length > 12
      ? "grid-cols-4 xl:grid-cols-5"
      : result && result.winners.length > 6
        ? "grid-cols-3 xl:grid-cols-4"
        : result && result.winners.length > 1
          ? "grid-cols-2 xl:grid-cols-3"
          : "mx-auto max-w-4xl";

  return (
    <main className="relative h-screen h-[100dvh] overflow-hidden bg-[#f7f9fb] p-2 text-[#191c1e] md:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,94,164,0.12),transparent_34%),radial-gradient(circle_at_88%_28%,rgba(0,106,98,0.18),transparent_38%)]" />

      <section className="relative mx-auto grid h-full min-h-0 w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-2xl bg-white/62 p-3 shadow-[0_28px_80px_-44px_rgba(0,96,168,0.55)] backdrop-blur-sm md:p-5">
        <header>
          <div>
            <p className="font-headline text-2xl font-extrabold tracking-tight text-[var(--primary)] md:text-4xl">CLUBE DO FRIO</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--outline)] md:text-sm md:tracking-[0.18em]">
              {eventName} | {new Date(`${eventDate}T12:00:00`).toLocaleDateString("pt-BR")}
            </p>
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
                  max={40}
                  value={winnersCount}
                  onChange={(event) => setWinnersCount(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
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
                <span>
                  <span className="block text-sm font-bold text-[var(--foreground)]">Incluir visitantes já sorteados</span>
                  <span className="mt-0.5 block text-xs text-muted">Por padrão, quem já ganhou no dia fica fora das próximas rodadas.</span>
                </span>
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
            <div className="flex h-full min-h-0 w-full flex-col justify-center">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--secondary)] md:text-sm">Rodada {result.roundNumber}</p>
                <h1 className="mt-1 font-headline text-[clamp(2rem,6vh,4.5rem)] font-extrabold leading-none tracking-tight">Ganhadores</h1>
              </div>

              <div className={`mt-3 grid gap-2 md:gap-3 ${resultGridClass}`}>
                {result.winners.map((winner) => (
                  <div key={winner.id} className="rounded-xl bg-white/90 px-3 py-2 text-center shadow-[0_18px_44px_-32px_rgba(0,96,168,0.48)] md:rounded-2xl md:px-4 md:py-3">
                    <p className="font-headline text-[clamp(1rem,2.8vh,2.25rem)] font-extrabold uppercase leading-tight tracking-tight text-[#111820]">
                      {winner.fullName}
                    </p>
                    <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--outline)] md:text-xs md:tracking-[0.18em]">
                      Participante {winner.participantNumber || "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={resetRound}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white md:px-6 md:text-base"
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
