"use client";

import { useEffect, useState } from "react";

type ReceptionModeShellProps = {
  children: React.ReactNode;
  resetKey: string;
};

export function ReceptionModeShell({ children, resetKey }: ReceptionModeShellProps) {
  const [isReceptionMode, setIsReceptionMode] = useState(false);
  const [privacyState, setPrivacyState] = useState({ resetKey, visible: false });
  const showSensitiveData = privacyState.resetKey === resetKey && privacyState.visible;

  useEffect(() => {
    function syncFullscreenState() {
      if (!document.fullscreenElement && isReceptionMode) {
        document.body.classList.remove("reception-mode");
        setIsReceptionMode(false);
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.body.classList.remove("reception-mode");
    };
  }, [isReceptionMode]);

  async function enterReceptionMode() {
    setPrivacyState({ resetKey, visible: false });
    setIsReceptionMode(true);
    document.body.classList.add("reception-mode");
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // O modo operacional continua ativo mesmo se o navegador bloquear a tela cheia.
    }
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("[data-reception-search]")?.focus();
    }, 50);
  }

  async function exitReceptionMode() {
    setIsReceptionMode(false);
    setPrivacyState({ resetKey, visible: false });
    document.body.classList.remove("reception-mode");
    if (document.fullscreenElement) await document.exitFullscreen();
  }

  return (
    <div className={showSensitiveData ? "" : "reception-privacy-hidden"}>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2" data-reception-controls>
        <button
          type="button"
          onClick={() => setPrivacyState({ resetKey, visible: !showSensitiveData })}
          className="rounded-xl border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--foreground)]"
        >
          {showSensitiveData ? "Ocultar dados" : "Mostrar dados"}
        </button>
        {isReceptionMode ? (
            <button
              type="button"
              onClick={exitReceptionMode}
              className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-bold text-white"
            >
              Sair do modo recepção
            </button>
        ) : (
          <button
            type="button"
            onClick={enterReceptionMode}
            className="gradient-primary rounded-xl px-5 py-3 text-sm font-bold text-white"
          >
            Iniciar modo recepção
          </button>
        )}
      </div>

      {children}

      <style jsx global>{`
        .reception-privacy-hidden .reception-sensitive {
          filter: blur(8px);
          user-select: none;
        }
        body.reception-mode {
          overflow: hidden;
        }
        body.reception-mode [data-dashboard-header],
        body.reception-mode [data-event-sidebar],
        body.reception-mode [data-event-context],
        body.reception-mode [data-reception-secondary] {
          display: none !important;
        }
        body.reception-mode [data-dashboard-main] {
          max-width: none;
          height: 100dvh;
          overflow: auto;
          padding: 12px;
        }
        body.reception-mode [data-event-shell] {
          display: block;
        }
        body.reception-mode [data-event-content] {
          width: 100%;
        }
        body.reception-mode [data-reception-controls] {
          position: sticky;
          top: 0;
          z-index: 50;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
