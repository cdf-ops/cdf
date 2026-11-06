"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SharedParticipant = {
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  profession?: string;
  job_title?: string;
  city?: string;
  state?: string;
};

type PendingCapture = {
  clientCaptureId: string;
  eventId: string;
  qrValue: string;
  capturedAt: string;
};

type ScannerResult = {
  kind: "success" | "warning" | "error";
  message: string;
  participant?: SharedParticipant;
};

const STORAGE_KEY = "clube-sponsor-pending-captures-v1";

function readQueue(): PendingCapture[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingCapture[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function createCaptureId() {
  return crypto.randomUUID();
}

function feedback(success: boolean) {
  if ("vibrate" in navigator) navigator.vibrate(success ? 120 : [80, 60, 80]);
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (success ? 0.12 : 0.22));
  } catch {
    // A vibração e o aviso visual continuam disponíveis quando o áudio é bloqueado.
  }
}

export function SponsorCaptureScanner({ eventId }: { eventId: string }) {
  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const [isAwaitingNext, setIsAwaitingNext] = useState(false);
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    pause: (shouldPauseVideo?: boolean) => void;
    resume: () => void;
  } | null>(null);
  const processingRef = useRef(false);
  const lastValueRef = useRef<{ value: string; at: number } | null>(null);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(readQueue().filter((item) => item.eventId === eventId).length);
  }, [eventId]);

  const sendCapture = useCallback(
    async (capture: PendingCapture, queuedOffline: boolean) => {
      const response = await fetch(`/api/patrocinador/eventos/${eventId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...capture, queuedOffline }),
      });
      const data = (await response.json()) as {
        error?: string;
        status?: "registered" | "already_registered";
        message?: string;
        participant?: SharedParticipant;
      };
      if (!response.ok) throw Object.assign(new Error(data.error ?? "Não foi possível ler a credencial."), { status: response.status });
      return data;
    },
    [eventId]
  );

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const all = readQueue();
    const currentEvent = all.filter((item) => item.eventId === eventId);
    if (!currentEvent.length) return;
    setIsSyncing(true);
    const remaining = all.filter((item) => item.eventId !== eventId);
    let synced = 0;
    for (const capture of currentEvent) {
      try {
        await sendCapture(capture, true);
        synced += 1;
      } catch (error) {
        const status = error instanceof Error && "status" in error ? Number(error.status) : 0;
        if (status === 401 || status >= 500 || status === 0) remaining.push(capture);
      }
    }
    writeQueue(remaining);
    refreshPendingCount();
    setIsSyncing(false);
    if (synced > 0) {
      setSessionCount((count) => count + synced);
      setResult({ kind: "success", message: `${synced} registro(s) pendente(s) sincronizado(s).` });
      feedback(true);
    }
  }, [eventId, isSyncing, refreshPendingCount, sendCapture]);

  const pauseCameraForFeedback = useCallback(() => {
    if (!scannerRef.current) return;
    try {
      scannerRef.current.pause(true);
      setIsAwaitingNext(true);
    } catch {
      // O retorno visual continua disponível mesmo se a câmera já tiver sido encerrada.
    }
  }, []);

  const processQrValue = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      const last = lastValueRef.current;
      if (!normalized || processingRef.current || (last?.value === normalized && Date.now() - last.at < 2500)) return;
      lastValueRef.current = { value: normalized, at: Date.now() };
      processingRef.current = true;
      setIsProcessing(true);
      setResult(null);
      const capture: PendingCapture = {
        clientCaptureId: createCaptureId(),
        eventId,
        qrValue: normalized,
        capturedAt: new Date().toISOString(),
      };
      try {
        if (!navigator.onLine) throw new TypeError("offline");
        const data = await sendCapture(capture, false);
        setResult({
          kind: data.status === "registered" ? "success" : "warning",
          message: data.message ?? "Leitura concluída.",
          participant: data.participant,
        });
        feedback(data.status === "registered");
        if (data.status === "registered") setSessionCount((count) => count + 1);
        pauseCameraForFeedback();
      } catch (error) {
        const isOffline = !navigator.onLine || error instanceof TypeError;
        if (isOffline) {
          const queue = readQueue();
          if (!queue.some((item) => item.eventId === eventId && item.qrValue === normalized)) {
            queue.push(capture);
            writeQueue(queue);
          }
          refreshPendingCount();
          setResult({
            kind: "warning",
            message: "Sem conexão. A leitura ficou pendente e será enviada quando a internet voltar.",
          });
          feedback(false);
          pauseCameraForFeedback();
        } else {
          setResult({ kind: "error", message: error instanceof Error ? error.message : "Falha na leitura." });
          feedback(false);
          pauseCameraForFeedback();
        }
      } finally {
        setManualValue("");
        window.setTimeout(() => {
          processingRef.current = false;
          setIsProcessing(false);
        }, 650);
      }
    },
    [eventId, pauseCameraForFeedback, refreshPendingCount, sendCapture]
  );

  useEffect(() => {
    refreshPendingCount();
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      void syncQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine) void syncQueue();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPendingCount, syncQueue]);

  useEffect(
    () => () => {
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current?.clear();
    },
    []
  );

  useEffect(() => {
    if (pendingCount === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [pendingCount]);

  async function startCamera() {
    if (cameraState !== "idle") return;
    setCameraState("starting");
    setResult(null);
    setIsAwaitingNext(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("sponsor-capture-camera-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (width, height) => {
            const size = Math.min(280, Math.floor(Math.min(width, height) * 0.78));
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
    setIsAwaitingNext(false);
  }

  function scanNextParticipant() {
    setResult(null);
    setIsAwaitingNext(false);
    lastValueRef.current = null;
    try {
      scannerRef.current?.resume();
    } catch {
      void stopCamera();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white p-3 text-center shadow-sm"><p className="text-xs text-muted">Nesta sessão</p><p className="mt-1 text-xl font-extrabold">{sessionCount}</p></div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm"><p className="text-xs text-muted">Pendentes</p><p className="mt-1 text-xl font-extrabold">{pendingCount}</p></div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm"><p className="text-xs text-muted">Conexão</p><p className={`mt-1 text-sm font-extrabold ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>{isOnline ? "Online" : "Offline"}</p></div>
      </div>
      {pendingCount > 0 ? (
        <div role="status" className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-amber-950 shadow-lg">
          <div><p className="font-bold">{pendingCount} leitura(s) não sincronizada(s)</p><p className="text-xs">Mantenha esta página aberta e recupere a conexão.</p></div>
          <button type="button" disabled={isSyncing || !isOnline} onClick={() => void syncQueue()} className="min-h-11 rounded-xl bg-amber-950 px-4 text-sm font-bold text-white disabled:opacity-50">{isSyncing ? "Enviando..." : "Sincronizar"}</button>
        </div>
      ) : null}

      <section className="rounded-3xl bg-slate-950 p-4 text-white shadow-xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-headline text-2xl font-extrabold">Escanear credencial</h2><p className="mt-1 text-sm text-slate-300">Após cada leitura, confirme o resultado para escanear a próxima pessoa.</p></div>
          {cameraState === "active" ? (
            <button type="button" onClick={() => void stopCamera()} className="min-h-14 rounded-2xl bg-white px-6 text-base font-bold text-slate-950">Fechar câmera</button>
          ) : (
            <button type="button" disabled={cameraState === "starting"} onClick={() => void startCamera()} className="min-h-14 rounded-2xl bg-[var(--primary)] px-6 text-base font-bold text-white disabled:opacity-60">{cameraState === "starting" ? "Abrindo câmera..." : "Abrir câmera"}</button>
          )}
        </div>
        <div id="sponsor-capture-camera-reader" className={`mt-5 overflow-hidden rounded-2xl bg-black ${cameraState === "idle" ? "hidden" : "min-h-72"}`} />
      </section>

      {result ? (
        <div role="status" aria-live="polite" className={`fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 shadow-2xl md:static md:max-h-none md:overflow-visible md:shadow-none ${result.kind === "success" ? "bg-emerald-100 text-emerald-950" : result.kind === "warning" ? "bg-amber-100 text-amber-950" : "bg-red-100 text-red-950"}`}>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em]">{result.kind === "success" ? "Participante registrado" : result.kind === "warning" ? "Atenção" : "Não foi possível registrar"}</p>
          {result.participant ? <><p className="mt-2 font-headline text-2xl font-extrabold">{result.participant.full_name}</p><dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{Object.entries(result.participant).filter(([key]) => key !== "full_name").map(([key, value]) => <div key={key}><dt className="inline font-bold">{{ email: "E-mail", phone: "Telefone", company: "Empresa", profession: "Profissão", job_title: "Cargo", city: "Cidade", state: "Estado" }[key] ?? key}: </dt><dd className="inline">{value}</dd></div>)}</dl></> : null}
          <p className="mt-2 font-semibold">{result.message}</p>
          {isAwaitingNext ? <button type="button" onClick={scanNextParticipant} className="mt-5 min-h-14 w-full rounded-xl bg-slate-950 px-5 text-base font-extrabold text-white">Escanear próximo participante</button> : null}
        </div>
      ) : null}

      <section className="surface-card hidden rounded-2xl p-4 md:block sm:p-5">
        <h3 className="font-headline text-lg font-bold">Leitor USB ou código</h3>
        <form className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void processQrValue(manualValue); }}>
          <input autoComplete="off" autoFocus value={manualValue} onChange={(event) => setManualValue(event.target.value)} disabled={isProcessing} className="min-h-14 min-w-0 rounded-xl border bg-white px-4 font-mono text-base" placeholder="Aguardando QR Code..." />
          <button disabled={isProcessing || !manualValue.trim()} className="min-h-14 rounded-xl bg-[var(--primary)] px-7 font-bold text-white disabled:opacity-60">{isProcessing ? "Lendo..." : "Registrar"}</button>
        </form>
      </section>

    </div>
  );
}
