"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ScannerResult = {
  kind: "success" | "warning" | "error";
  message: string;
  participantNumber?: number;
  participantName?: string;
};

type BadgeScannerProps = {
  eventId: string;
  eventDayId: string;
  initialQrValue?: string;
};

export function BadgeScanner({ eventId, eventDayId, initialQrValue }: BadgeScannerProps) {
  const router = useRouter();
  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const processingRef = useRef(false);
  const initialProcessedRef = useRef(false);

  const processQrValue = useCallback(async (value: string) => {
    if (processingRef.current || !value.trim()) return;
    processingRef.current = true;
    setIsProcessing(true);
    setResult(null);
    try {
      const response = await fetch(`/api/events/${eventId}/badge-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDayId, qrValue: value }),
      });
      const data = (await response.json()) as {
        error?: string;
        status?: "checked_in" | "already_checked_in";
        message?: string;
        participant?: { full_name: string; participant_number: number };
      };
      if (!response.ok) {
        setResult({ kind: "error", message: data.error ?? "Não foi possível ler a credencial." });
      } else {
        setResult({
          kind: data.status === "checked_in" ? "success" : "warning",
          message: data.message ?? "Leitura concluída.",
          participantNumber: data.participant?.participant_number,
          participantName: data.participant?.full_name,
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
  }, [eventDayId, eventId, router]);

  useEffect(() => {
    if (!initialQrValue || initialProcessedRef.current) return;
    initialProcessedRef.current = true;
    void processQrValue(initialQrValue);
  }, [initialQrValue, processQrValue]);

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current?.clear();
    };
  }, []);

  async function startCamera() {
    if (cameraState !== "idle") return;
    setCameraState("starting");
    setResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("badge-camera-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.min(240, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75));
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
            <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Câmera do celular ou computador</h3>
            <p className="mt-1 text-xs text-muted">Aponte para o QR frontal da credencial.</p>
          </div>
          {cameraState === "active" ? (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold sm:shrink-0"
            >
              Fechar câmera
            </button>
          ) : (
            <button
              type="button"
              disabled={cameraState === "starting"}
              onClick={() => void startCamera()}
              className="gradient-primary min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 sm:shrink-0"
            >
              {cameraState === "starting" ? "Abrindo..." : "Abrir câmera"}
            </button>
          )}
        </div>
        <div
          id="badge-camera-reader"
          className={`mt-4 overflow-hidden rounded-xl bg-black ${cameraState === "idle" ? "hidden" : "min-h-64"}`}
        />
      </div>

      <div className="rounded-2xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Leitor USB ou equipamento</h3>
        <p className="mt-1 text-xs text-muted">Clique no campo e faça a leitura. Equipamentos que funcionam como teclado são aceitos.</p>
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
            className="min-h-12 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isProcessing ? (
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : null}
              {isProcessing ? "Lendo..." : "Ler"}
            </span>
          </button>
        </form>

        {result ? (
          <div className={`mt-4 rounded-xl p-4 ${result.kind === "success" ? "bg-emerald-100 text-emerald-800" : result.kind === "warning" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`} role="status">
            {result.participantNumber ? <p className="font-mono text-3xl font-black">{result.participantNumber}</p> : null}
            {result.participantName ? <p className="mt-1 text-lg font-bold">{result.participantName}</p> : null}
            <p className="mt-1 text-sm font-semibold">{result.message}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
