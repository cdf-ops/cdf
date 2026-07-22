"use client";

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
  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const processingRef = useRef(false);
  const initialProcessedRef = useRef(false);

  const processQrValue = useCallback(async (value: string) => {
    if (processingRef.current || !value.trim()) return;
    processingRef.current = true;
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
        if (data.status === "checked_in" && "vibrate" in navigator) navigator.vibrate(120);
      }
      setManualValue("");
    } catch {
      setResult({ kind: "error", message: "Falha de conexão. Verifique a internet e tente novamente." });
    } finally {
      window.setTimeout(() => {
        processingRef.current = false;
      }, 700);
    }
  }, [eventDayId, eventId]);

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
        { fps: 12, qrbox: { width: 240, height: 240 } },
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Câmera do celular ou computador</h3>
            <p className="mt-1 text-xs text-muted">Aponte para o QR frontal da credencial.</p>
          </div>
          {cameraState === "active" ? (
            <button type="button" onClick={() => void stopCamera()} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Fechar câmera</button>
          ) : (
            <button type="button" disabled={cameraState === "starting"} onClick={() => void startCamera()} className="gradient-primary rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
              {cameraState === "starting" ? "Abrindo..." : "Abrir câmera"}
            </button>
          )}
        </div>
        <div id="badge-camera-reader" className={`mt-4 overflow-hidden rounded-xl bg-black ${cameraState === "idle" ? "hidden" : "min-h-64"}`} />
      </div>

      <div className="rounded-2xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] p-4">
        <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">Leitor USB ou equipamento</h3>
        <p className="mt-1 text-xs text-muted">Clique no campo e faça a leitura. Equipamentos que funcionam como teclado são aceitos.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void processQrValue(manualValue);
          }}
        >
          <input autoFocus value={manualValue} onChange={(event) => setManualValue(event.target.value)} className="min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 font-mono text-sm" placeholder="Aguardando QR Code..." />
          <button className="rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white">Ler</button>
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
