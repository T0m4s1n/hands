/**
 * The camera is asked for here, not in the tracking hook. The hook owns the
 * stream once it exists; getting the stream is a UI problem (permission
 * prompt, denial, fallback), so it lives next to the screens that have to
 * explain those states.
 */

export function errorName(err: unknown): string {
  return err instanceof DOMException || err instanceof Error ? err.name : "";
}

export function describeCameraError(
  err: unknown,
  cameras: MediaDeviceInfo[],
): string {
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

export async function queryCameraPermission(): Promise<
  PermissionState | "unknown"
> {
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

const PLAYABLE_VIDEO: MediaTrackConstraints = {
  facingMode: { ideal: "user" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

export function startCameraRequests(
  media: MediaDevices,
  deviceIds: string[],
): Promise<MediaStream>[] {
  const requests: Promise<MediaStream>[] = [
    media.getUserMedia({ video: PLAYABLE_VIDEO }),
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

export function keepFirstStream(
  requests: Promise<MediaStream>[],
): Promise<MediaStream> {
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

export async function requestCamera(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) {
    throw new Error("This browser did not expose camera APIs.");
  }
  let ids: string[] = [];
  try {
    const devices = await media.enumerateDevices();
    ids = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => device.deviceId);
  } catch {
    ids = [];
  }
  try {
    return await keepFirstStream(startCameraRequests(media, ids));
  } catch (err) {
    throw err instanceof AggregateError ? err.errors[0] : err;
  }
}
