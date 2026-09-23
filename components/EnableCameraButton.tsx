"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type EnableCameraButtonProps = {
  onStream: (stream: MediaStream) => void;
  onPointerFallback: () => void;
};

function errorName(err: unknown): string {
  return err instanceof DOMException || err instanceof Error ? err.name : "";
}

function describeCameraError(err: unknown, cameras: MediaDeviceInfo[]): string {
  const name = errorName(err);
  const listed = cameras.length
    ? cameras
        .map((camera, index) => camera.label || camera.deviceId || `camera ${index + 1}`)
        .join(", ")
    : "none detected";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access is blocked for this site. Open the site permissions icon in your browser's address bar, set Camera to Allow, then try again.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera is in use by another app. Close any other video app (Teams, Zoom, Discord, Camera) and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return `No camera was found (${listed}). Confirm a webcam is connected and that your OS allows browsers to access it — on Windows, check Settings → Privacy & security → Camera.`;
  }
  return err instanceof Error ? err.message : String(err);
}

function startCameraRequests(media: MediaDevices, deviceIds: string[]): Promise<MediaStream>[] {
  const requests: Promise<MediaStream>[] = [
    media.getUserMedia({ video: true }),
    media.getUserMedia({ video: {} }),
  ];
  for (const deviceId of deviceIds) {
    if (!deviceId) continue;
    requests.push(
      media.getUserMedia({
        video: { deviceId: { ideal: deviceId } },
      }),
    );
  }
  return requests;
}

function keepFirstStream(requests: Promise<MediaStream>[]): Promise<MediaStream> {
  return Promise.any(requests).then((stream) => {
    for (const request of requests) {
      void request
        .then((other) => {
          if (other !== stream) other.getTracks().forEach((track) => track.stop());
        })
        .catch(() => undefined);
    }
    stream.getAudioTracks().forEach((track) => track.stop());
    return stream;
  });
}

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
