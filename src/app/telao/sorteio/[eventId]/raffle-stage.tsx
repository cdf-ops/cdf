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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f9fb] px-4 py-5 text-[#191c1e] md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,94,164,0.12),transparent_34%),radial-gradient(circle_at_88%_28%,rgba(0,106,98,0.18),transparent_38%)]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-7xl flex-col rounded-2xl bg-white/62 p-5 shadow-[0_28px_80px_-44px_rgba(0,96,168,0.55)] backdrop-blur-sm md:min-h-[calc(100vh-64px)] md:p-8">
        <header>
          <div>
            <p className="font-headline text-3xl font-extrabold tracking-tight text-[var(--primary)] md:text-5xl">CLUBE DO FRIO</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--outline)]">
              {eventName} | {new Date(`${eventDate}T12:00:00`).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-4 md:py-6">
          {stage === "setup" ? (
            <div className="w-full max-w-xl rounded-2xl bg-white/88 p-6 text-center shadow-[0_18px_48px_-30px_rgba(0,96,168,0.5)] md:p-8">
              <p className="font-headline text-4xl font-extrabold tracking-tight md:text-6xl">Nova rodada</p>
              <p className="mt-3 text-base text-muted">Escolha quantos participantes serão sorteados nesta rodada.</p>

              <label className="mt-7 block text-left text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
                Quantidade de ganhadores
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={winnersCount}
                  onChange={(event) => setWinnersCount(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
                  className="mt-2 h-14 w-full rounded-xl border border-[var(--outline-variant)]/60 bg-white px-4 text-center text-2xl font-extrabold outline-none focus:border-[var(--primary)]"
                />
              </label>

              <label className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4 text-left">
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

              {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}

              <button
                type="button"
                onClick={runDraw}
                disabled={isPending}
                className="gradient-primary mt-6 h-14 w-full rounded-xl px-5 text-base font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                className="mt-4 animate-ping font-headline text-[10rem] font-extrabold leading-none text-[var(--primary)] md:text-[18rem]"
              >
                {countdown}
              </p>
            </div>
          ) : null}

          {stage === "drawing" ? (
            <div className="text-center">
              <p className="font-headline text-5xl font-extrabold tracking-tight md:text-7xl">Sorteando...</p>
              <p className="mt-3 text-lg text-muted">Só mais um instante.</p>
            </div>
          ) : null}

          {stage === "result" && result ? (
            <div className="w-full">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--secondary)]">Rodada {result.roundNumber}</p>
                <h1 className="mt-2 font-headline text-4xl font-extrabold tracking-tight md:text-7xl">Ganhadores</h1>
              </div>

              <div className={`mt-8 grid gap-3 ${result.winners.length === 1 ? "mx-auto max-w-4xl" : "md:grid-cols-2 xl:grid-cols-3"}`}>
                {result.winners.map((winner) => (
                  <div key={winner.id} className="rounded-2xl bg-white/90 px-4 py-5 text-center shadow-[0_18px_44px_-32px_rgba(0,96,168,0.48)]">
                    <p className="font-headline text-2xl font-extrabold uppercase leading-tight tracking-tight text-[#111820] md:text-4xl">
                      {winner.fullName}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
                      Participante {winner.participantNumber || "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={resetRound}
                  className="rounded-xl bg-[var(--primary)] px-6 py-3 text-base font-bold text-white"
                >
                  Nova rodada de sorteio
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {sponsorBannerUrl ? (
          <footer className="flex shrink-0 justify-center pt-2">
            <div
              role="img"
              aria-label="Patrocinadores do evento"
              className="aspect-[10/3] w-full max-w-[1000px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${sponsorBannerUrl}")` }}
            />
          </footer>
        ) : null}
      </section>
    </main>
  );
}
