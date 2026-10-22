"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TerminalShellProps = {
  children: React.ReactNode;
  eventHref: string;
  resetKey: string;
};

export function TerminalShell({ children, eventHref, resetKey }: TerminalShellProps) {
  const [privacyState, setPrivacyState] = useState({ resetKey, visible: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const showSensitiveData = privacyState.resetKey === resetKey && privacyState.visible;

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    document.querySelector<HTMLInputElement>("[data-terminal-search]")?.focus();
  }, [resetKey]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // O terminal continua isolado mesmo quando o navegador bloqueia a tela cheia nativa.
    }
  }

  return (
    <div className={showSensitiveData ? "min-h-dvh" : "terminal-privacy-hidden min-h-dvh"}>
      <div className="fixed right-3 top-3 z-50 flex flex-wrap justify-end gap-2 sm:right-5 sm:top-5">
        <button
          type="button"
          onClick={() => setPrivacyState({ resetKey, visible: !showSensitiveData })}
          className="min-h-10 rounded-xl border border-[var(--outline-variant)] bg-white/95 px-3 text-xs font-bold text-[var(--foreground)] shadow-sm backdrop-blur"
        >
          {showSensitiveData ? "Ocultar dados" : "Mostrar dados"}
        </button>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="min-h-10 rounded-xl border border-[var(--outline-variant)] bg-white/95 px-3 text-xs font-bold text-[var(--foreground)] shadow-sm backdrop-blur"
        >
          {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        </button>
        <Link
          href={eventHref}
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--foreground)] px-3 text-xs font-bold text-white shadow-sm"
        >
          Encerrar terminal
        </Link>
      </div>

      {children}

      <style jsx global>{`
        .terminal-privacy-hidden .terminal-sensitive {
          filter: blur(9px);
          user-select: none;
        }
      `}</style>
    </div>
  );
}
