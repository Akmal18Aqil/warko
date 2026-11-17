import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type CameraErrorKind = "denied" | "unavailable";

export interface ScannerCamera {
  videoRef: RefObject<HTMLVideoElement | null>;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  selectDevice: (deviceId: string) => void;
  hasTorch: boolean;
  torchOn: boolean;
  toggleTorch: () => void;
  error: CameraErrorKind | null;
}

const SCAN_DELAY_MS = 150;
const SUCCESS_DELAY_MS = 1000;

function torchConstraints(on: boolean): MediaTrackConstraints {
  // `torch` is a widely supported but not yet standard constraint, so it is missing from the DOM typings.
  return { advanced: [{ torch: on } as MediaTrackConstraintSet] };
}

/**
 * Runs the camera stream and the ZXing decode loop while `active` is true, and releases the
 * stream and the decoder when it turns false or the component unmounts.
 */
export function useScannerCamera(active: boolean, onDecode: (text: string) => void): ScannerCamera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<CameraErrorKind | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let controls: { stop: () => void } | null = null;
    let stream: MediaStream | null = null;
    const video = videoRef.current;

    const start = async () => {
      setError(null);
      setTorchOn(false);
      setHasTorch(false);
      try {
        if (!video) return;
        // Lazy: the decoder is only fetched once the camera is actually used.
        const { createScanReader } = await import("./zxingReader");
        const reader = createScanReader({
          delayBetweenScanAttempts: SCAN_DELAY_MS,
          delayBetweenScanSuccess: SUCCESS_DELAY_MS,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        // Labels are only available after permission is granted, so list cameras afterwards.
        void navigator.mediaDevices
          .enumerateDevices()
          .then((all) => {
            if (!stopped) setDevices(all.filter((device) => device.kind === "videoinput"));
          })
          .catch(() => undefined);

        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setHasTorch(Boolean(capabilities?.torch));

        controls = await reader.decodeFromVideoElement(video, (result) => {
          if (!stopped && result) onDecodeRef.current(result.getText());
        });
        if (stopped) controls.stop();
      } catch (err) {
        if (stopped) return;
        console.error("Kamera gagal dibuka:", err);
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(denied ? "denied" : "unavailable");
      }
    };
    void start();

    return () => {
      stopped = true;
      controls?.stop();
      if (stream) for (const track of stream.getTracks()) track.stop();
      trackRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [active, selectedDeviceId]);

  const toggleTorch = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    track
      .applyConstraints(torchConstraints(next))
      .then(() => setTorchOn(next))
      .catch((err: unknown) => console.error("Senter tidak dapat diubah:", err));
  }, [torchOn]);

  return { videoRef, devices, selectedDeviceId, selectDevice: setSelectedDeviceId, hasTorch, torchOn, toggleTorch, error };
}
