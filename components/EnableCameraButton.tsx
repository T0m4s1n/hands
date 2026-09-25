"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  describeCameraError,
  keepFirstStream,
  startCameraRequests,
} from "@/hooks/requestCamera";

type EnableCameraButtonProps = {
  onStream: (stream: MediaStream) => void;
  onPointerFallback: () => void;
};

export function EnableCameraButton({
  onStream,
  onPointerFallback,
}: EnableCameraButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onStreamRef = useRef(onStream);
  const camerasRef = useRef<MediaDeviceInfo[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState("Checking camera availability…");

  useEffect(() => {
    onStreamRef.current = onStream;
  }, [onStream]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const secure = window.isSecureContext;
      const origin = window.location.origin;
      const framed = window.top !== window.self;
      let permission = "unknown";
      try {
        const status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        permission = status.state;
      } catch {
        permission = "query-unsupported";
      }

      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        devices = [];
      }
      const cameras = devices.filter((device) => device.kind === "videoinput");
      camerasRef.current = cameras;
      const mics = devices.filter((device) => device.kind === "audioinput").length;

      if (!cancelled) {
        setDiagnostics(
          `origin: ${origin}\nsecure context: ${secure}\nembedded: ${framed}\npermission: ${permission}\ncameras: ${cameras.length}\nmicrophones: ${mics}`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = useCallback((err: unknown) => {
    console.error("getUserMedia failed", err);
    setWaiting(false);
    setError(describeCameraError(err, camerasRef.current));
  }, []);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const onClick = () => {
      const media = navigator.mediaDevices;
      if (!media?.getUserMedia) {
        setError("This browser did not expose camera APIs.");
        return;
      }
      const requests = startCameraRequests(
        media,
        camerasRef.current.map((camera) => camera.deviceId),
      );
      setWaiting(true);
      setError(null);
      void keepFirstStream(requests)
        .then((stream) => onStreamRef.current(stream))
        .catch((err: unknown) => {
          const inner = err instanceof AggregateError ? err.errors[0] : err;
          fail(inner);
        });
    };

    button.addEventListener("click", onClick);
    return () => button.removeEventListener("click", onClick);
  }, [fail]);

  return (
    <div className="mt-6 space-y-3">
      {/* One filled button: the single thing this screen exists to do. */}
      <Button
        ref={buttonRef}
        disabled={waiting}
        className="w-full"
        aria-busy={waiting}
      >
        {waiting ? "Esperando permiso…" : "Activar cámara"}
      </Button>
      <Button variant="plain" className="w-full" onClick={onPointerFallback}>
        Continuar con el ratón
      </Button>
      <p className="t-caption text-label-3">
        Con ratón: mantén pulsado para tomar y usa la rueda para inclinar y
        verter.
      </p>
      {error && (
        <p className="t-subhead rounded-tile bg-fill p-3 text-left text-label-2">
          {error}
        </p>
      )}
      <details>
        <summary className="t-footnote cursor-pointer list-none text-label-3 transition hover:text-label-2">
          Diagnóstico
        </summary>
        <pre className="t-caption mt-2 whitespace-pre-wrap rounded-tile bg-black/30 p-3 font-mono leading-5 text-label-3">
          {diagnostics}
        </pre>
      </details>
    </div>
  );
}
