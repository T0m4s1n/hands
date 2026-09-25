"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  errorName,
  queryCameraPermission,
  requestCamera,
} from "@/hooks/requestCamera";
import { playSfx, unlockAudio } from "@/lib/audio";

type Mood = "hope" | "cry";

function gateCopy(err: unknown): string {
  const name = errorName(err);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "El navegador no dejó pasar la cámara. Ábrela en el candado de la barra, o sigue con el ratón.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Otra aplicación tiene la cámara. Ciérrala y vuelve a intentar, o sigue con el ratón.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No hay cámara en este aparato. Sigue con el ratón, o enchufa una y vuelve a intentar.";
  }
  return "Sin cámara no puede preparar nada. Dale permiso, o sigue con el ratón.";
}

function Steam({ delay }: { delay: string }) {
  return (
    <path
      className="gate-steam"
      style={{ animationDelay: delay }}
      d="M0 28c0-10 7-12 4-22"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  );
}

function Tear({ className, cx }: { className: string; cx: number }) {
  return (
    <g className={className} style={{ transformOrigin: `${cx}px 108px` }}>
      <path
        d={`M${cx} 104c0 7 7 11 7 16 0 4.4-3.2 7.4-7 7.4s-7-3-7-7.4c0-5 7-9 7-16z`}
        fill="#9ec9e0"
      />
    </g>
  );
}

function Cup({ mood }: { mood: Mood }) {
  return (
    <svg
      viewBox="0 0 160 176"
      className="h-40 w-40 text-cream sm:h-48 sm:w-48"
      aria-hidden
    >
      <g className={mood === "cry" ? "gate-cup-sob" : undefined}>
        {mood === "hope" && (
          <g className="text-cream/70">
            <g transform="translate(62 18)">
              <Steam delay="0s" />
            </g>
            <g transform="translate(80 10)">
              <Steam delay="-1.4s" />
            </g>
            <g transform="translate(96 20)">
              <Steam delay="-2.6s" />
            </g>
          </g>
        )}

        <ellipse cx="80" cy="142" rx="50" ry="9" fill="currentColor" opacity="0.22" />
        <path
          d="M40 70h80l-8 56a30 30 0 0 1-64 0z"
          fill="currentColor"
        />
        <path
          d="M120 80h13a17 17 0 0 1 0 34h-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse cx="80" cy="70" rx="40" ry="11" fill="#3d1206" opacity="0.35" />

        {mood === "cry" ? (
          <>
            <path
              d="M60 90c5 8 14 8 18 0"
              fill="none"
              stroke="#3d1206"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <path
              d="M82 90c5 8 14 8 18 0"
              fill="none"
              stroke="#3d1206"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <path
              d="M68 114c8-7 16-7 24 0"
              fill="none"
              stroke="#3d1206"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <Tear className="gate-tear gate-tear-a" cx={58} />
            <Tear className="gate-tear gate-tear-b" cx={102} />
          </>
        ) : (
          <>
            <circle cx="68" cy="96" r="3.2" fill="#3d1206" />
            <circle cx="92" cy="96" r="3.2" fill="#3d1206" />
            <path
              d="M70 112c6 7 14 7 20 0"
              fill="none"
              stroke="#3d1206"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
    </svg>
  );
}

export function CameraGate({
  loading,
  onStream,
  onPointerFallback,
}: {
  loading: boolean;
  onStream: (stream: MediaStream) => void;
  onPointerFallback: () => void;
}) {
  const onStreamRef = useRef(onStream);
  const askedRef = useRef(false);
  const deliveredRef = useRef(false);
  const [asking, setAsking] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [line, setLine] = useState("Pidiendo la cámara…");

  useEffect(() => {
    onStreamRef.current = onStream;
  }, [onStream]);

  const fail = useCallback((err: unknown) => {
    console.error("getUserMedia failed", err);
    playSfx("error");
    setAsking(false);
    setWaiting(false);
    setLine(gateCopy(err));
  }, []);

  const open = useCallback(async () => {
    unlockAudio();
    playSfx("click");
    setWaiting(true);
    setAsking(true);
    setLine("Pidiendo la cámara…");
    try {
      const stream = await requestCamera();
      deliveredRef.current = true;
      playSfx("open");
      onStreamRef.current(stream);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    if (loading || askedRef.current) return;
    askedRef.current = true;
    let cancelled = false;
    const hung = window.setTimeout(() => {
      if (cancelled || deliveredRef.current) return;
      setAsking(false);
      setLine(
        "Sin cámara no puede preparar nada. Dale permiso, o sigue con el ratón.",
      );
    }, 2800);
    void (async () => {
      const permission = await queryCameraPermission();
      if (cancelled) return;
      if (permission === "denied") {
        fail(new DOMException("Permission denied", "NotAllowedError"));
        return;
      }
      try {
        const stream = await requestCamera();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        deliveredRef.current = true;
        playSfx("open");
        onStreamRef.current(stream);
      } catch (err) {
        if (!cancelled) fail(err);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(hung);
    };
  }, [fail, loading]);

  useEffect(() => {
    if (!deliveredRef.current || loading) return;
    fail(new Error("Failed to start hand tracking."));
  }, [fail, loading]);

  const busy = asking || loading || waiting;
  const mood: Mood = busy ? "hope" : "cry";
  const title = mood === "cry" ? "La taza no te ve" : "Café a mano";
  const body = loading ? "Cámara lista. Cargando las manos…" : line;

  return (
    <div className="gate-veil absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="gate-title">{title}</h1>
      <div className="mt-4 sm:mt-6">
        <Cup mood={mood} />
      </div>
      <p className="t-body mt-2 max-w-md text-label-2">{body}</p>
      {!busy && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              playSfx("click");
              onPointerFallback();
            }}
          >
            Continuar con el ratón
          </Button>
          <Button
            disabled={waiting}
            aria-busy={waiting}
            onClick={() => void open()}
          >
            Aceptar cámara
          </Button>
        </div>
      )}
      <p className="t-footnote absolute inset-x-0 bottom-6 text-label-3">
        El seguimiento corre en tu navegador. No se sube nada.
      </p>
    </div>
  );
}
