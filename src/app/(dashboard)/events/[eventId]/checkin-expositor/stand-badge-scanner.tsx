"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SharedParticipant = {
  participant_number: number;
  full_name: string;
  email?: string;
  phone?: string;
  profession?: string;
  city?: string;
  state?: string;
};

type ScannerResult = {
  kind: "success" | "warning" | "error";
  message: string;
  participant?: SharedParticipant | null;
};

type StandBadgeScannerProps = {
  eventId: string;
  eventDayId: string;
  initialQrValue?: string;
};

export function StandBadgeScanner({ eventId, eventDayId, initialQrValue }: StandBadgeScannerProps) {
  const router = useRouter();
  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const processingRef = useRef(false);
  const initialProcessedRef = useRef(false);

  const processQrValue = useCallback(
    async (value: string) => {
      if (processingRef.current || !value.trim()) return;
      processingRef.current = true;
      setIsProcessing(true);
      setResult(null);
      try {
        const response = await fetch(`/api/events/${eventId}/stand-badge-checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventDayId, qrValue: value }),
        });
        const data = (await response.json()) as {
          error?: string;
          status?: "checked_in" | "already_checked_in";
          message?: string;
          participant?: SharedParticipant | null;
        };
        if (!response.ok) {
          setResult({ kind: "error", message: data.error ?? "Não foi possível ler a credencial." });
        } else {
          setResult({
            kind: data.status === "checked_in" ? "success" : "warning",
            message: data.message ?? "Leitura concluída.",
            participant: data.participant,
          });
          if (data.status === "checked_in") {
            if ("vibrate" in navigator) navigator.vibrate(120);
            router.refresh();
          }
        }
        setManualValue("");
      } catch {
        setResult({ kind: "error", message: "Falha de conexão. Verifique a internet e tente novamente." });
      } finally {
        window.setTimeout(() => {
          processingRef.current = false;
          setIsProcessing(false);
        }, 700);
      }
    },
    [eventDayId, eventId, router]
  );

  useEffect(() => {
    if (!initialQrValue || initialProcessedRef.current) return;
    initialProcessedRef.current = true;
    void processQrValue(initialQrValue);
  }, [initialQrValue, processQrValue]);

  useEffect(
    () => () => {
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current?.clear();
    },
    []
  );

  async function startCamera() {
    if (cameraState !== "idle") return;
    setCameraState("starting");
    setResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("stand-badge-camera-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (width, height) => {
            const size = Math.min(240, Math.floor(Math.min(width, height) * 0.75));
            return { width: size, height: size };
          },
        },
        (decodedText) => void processQrValue(decodedText),
        () => undefined
      );
      setCameraState("active");
    } catch {
      setCameraState("idle");
      setResult({ kind: "error", message: "Não foi possível abrir a câmera. Confira a permissão do navegador." });
    }
  }

  async function stopCamera() {
    await scannerRef.current?.stop().catch(() => undefined);
    scannerRef.current?.clear();
    scannerRef.current = null;
    setCameraState("idle");
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-headline text-lg font-bold">Câmera do celular ou computador</h3>
            <p className="mt-1 text-xs text-muted">Aponte para o QR Code da credencial.</p>
          </div>
          {cameraState === "active" ? (
            <button type="button" onClick={() => void stopCamera()} className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold">
              Fechar câmera
            </button>
          ) : (
            <button
              type="button"
              disabled={cameraState === "starting"}
              onClick={() => void startCamera()}
              className="gradient-primary min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {cameraState === "starting" ? "Abrindo..." : "Abrir câmera"}
            </button>
          )}
        </div>
        <div
          id="stand-badge-camera-reader"
          className={`mt-4 overflow-hidden rounded-xl bg-black ${cameraState === "idle" ? "hidden" : "min-h-64"}`}
        />
      </div>

      <div className="rounded-2xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
        <h3 className="font-headline text-lg font-bold">Leitor USB ou equipamento</h3>
        <p className="mt-1 text-xs text-muted">Equipamentos que funcionam como teclado também são aceitos.</p>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void processQrValue(manualValue);
          }}
        >
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            disabled={isProcessing}
            className="min-h-12 min-w-0 rounded-xl border bg-white px-4 font-mono text-sm"
            placeholder="Aguardando QR Code..."
          />
          <button
            disabled={isProcessing || !manualValue.trim()}
            aria-busy={isProcessing}
            className="min-h-12 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:opacity-70"
          >
            {isProcessing ? "Lendo..." : "Ler"}
          </button>
        </form>

        {result ? (
          <div
            role="status"
            className={`mt-4 rounded-xl p-4 ${
              result.kind === "success"
                ? "bg-emerald-100 text-emerald-800"
                : result.kind === "warning"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {result.participant ? (
              <>
                <p className="font-mono text-3xl font-black">{result.participant.participant_number}</p>
                <p className="mt-1 text-lg font-bold">{result.participant.full_name}</p>
                <dl className="mt-3 grid gap-1 text-sm">
                  {result.participant.email ? <div><dt className="inline font-bold">E-mail: </dt><dd className="inline">{result.participant.email}</dd></div> : null}
                  {result.participant.phone ? <div><dt className="inline font-bold">Telefone: </dt><dd className="inline">{result.participant.phone}</dd></div> : null}
                  {result.participant.profession ? <div><dt className="inline font-bold">Profissão: </dt><dd className="inline">{result.participant.profession}</dd></div> : null}
                  {result.participant.city || result.participant.state ? (
                    <div><dt className="inline font-bold">Localidade: </dt><dd className="inline">{[result.participant.city, result.participant.state].filter(Boolean).join(" / ")}</dd></div>
                  ) : null}
                </dl>
              </>
            ) : null}
            <p className="mt-2 text-sm font-semibold">{result.message}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
