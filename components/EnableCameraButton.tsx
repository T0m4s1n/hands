"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    <div className="mt-5 space-y-3">
      <button
        ref={buttonRef}
        type="button"
        disabled={waiting}
        className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-80"
      >
        {waiting ? "Waiting for permission…" : "Enable camera"}
      </button>
      <button
        type="button"
        onClick={onPointerFallback}
        className="block w-full text-sm text-slate-300 underline-offset-2 hover:underline"
      >
        Continue with mouse instead
      </button>
      {error && (
        <p className="text-left text-sm leading-6 text-amber-200">{error}</p>
      )}
      <details className="text-left text-slate-500">
        <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-300">
          Diagnostics
        </summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-mono text-[11px] leading-5 text-slate-500">
          {diagnostics}
        </pre>
      </details>
    </div>
  );
}
