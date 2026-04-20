"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, Loader2 } from "lucide-react";

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

export default function HLSPlayer({
  vehicleId,
  channel,
  vehicleName,
  onStop,
  fallbackVehicleIds = [],
}: HLSPlayerProps) {
  const targetLiveDelaySeconds = 3;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fatalErrorCountRef = useRef(0);
  const [status, setStatus] = useState("Starting stream...");
  const [stats, setStats] = useState("Waiting for stream...");
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const candidateVehicleIds = Array.from(
      new Set([vehicleId, ...fallbackVehicleIds].map((value) => String(value || "").trim()).filter(Boolean))
    );
    let activeVehicleId = vehicleId;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearStatsTimer = () => {
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    };

    const cleanupHls = () => {
      clearRetry();
      clearStatsTimer();
      fatalErrorCountRef.current = 0;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {}
        video.removeAttribute("src");
        video.load();
      }
    };

    const attachNativeHls = (video: HTMLVideoElement, hlsUrl: string) => {
      video.src = `${hlsUrl}?_ts=${Date.now()}`;
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (!mounted) return;
          setStatus("Streaming");
          setError(false);
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        () => {
          if (!mounted) return;
          setStatus("Stream unavailable");
          setError(true);
        },
        { once: true }
      );
    };

    const attachHls = (video: HTMLVideoElement, hlsUrl: string) => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 20,
          maxBufferLength: 10,
          maxMaxBufferLength: 14,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          liveDurationInfinity: true,
          maxLiveSyncPlaybackRate: 1.05,
        });

        hlsRef.current = hls;
        hls.loadSource(`${hlsUrl}?_ts=${Date.now()}`);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!mounted) return;
          fatalErrorCountRef.current = 0;
          setStatus("Streaming");
          setError(false);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_UPDATED, (_event, data) => {
          if (!mounted || !Number.isFinite(data.details?.edge)) return;
          const liveEdge = Number(data.details.edge);
          const latency = liveEdge - video.currentTime;
          if (Number.isFinite(latency) && latency > targetLiveDelaySeconds + 1.5) {
            const targetTime = Math.max(0, liveEdge - targetLiveDelaySeconds);
            if (Math.abs(video.currentTime - targetTime) > 0.25) {
              video.currentTime = targetTime;
            }
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || !mounted) return;

          fatalErrorCountRef.current += 1;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setStatus("Recovering stream...");
            setError(false);
            try {
              hls.startLoad();
            } catch {}
            if (fatalErrorCountRef.current < 3) return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setStatus("Recovering stream...");
            setError(false);
            try {
              hls.recoverMediaError();
            } catch {}
            if (fatalErrorCountRef.current < 3) return;
          }

          setStatus("Reconnecting stream...");
          setError(false);
          cleanupHls();
          retryTimerRef.current = setTimeout(() => {
            if (!mounted) return;
            void startStreamAndAttach();
          }, 2500);
        });

        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        attachNativeHls(video, hlsUrl);
        return;
      }

      setStatus("HLS not supported");
      setError(true);
    };

    const startStreamAndAttach = async () => {
      const video = videoRef.current;
      if (!video || !mounted) return;

      cleanupHls();
      setStatus("Starting stream...");
      setError(false);

      let started = false;
      for (const candidateId of candidateVehicleIds) {
        try {
          const response = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel }),
          });

          if (response.ok) {
            activeVehicleId = candidateId;
            started = true;
            break;
          }
        } catch {}
      }

      if (!mounted) return;

      if (!started && candidateVehicleIds.length === 0) {
        setStatus("Failed to start");
        setError(true);
        return;
      }

      const hlsUrl = `/api/video-server/stream/${encodeURIComponent(activeVehicleId)}/${encodeURIComponent(String(channel))}/playlist.m3u8`;
      setStatus("Loading stream...");
      attachHls(video, hlsUrl);
    };

    const video = videoRef.current;
    const updateStats = () => {
      if (!video) return;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const buffered = Math.max(0, bufferedEnd - video.currentTime);
        const liveLag = Math.max(0, bufferedEnd - video.currentTime);
        if (liveLag > targetLiveDelaySeconds + 1.5 && !video.paused) {
          video.currentTime = Math.max(0, bufferedEnd - targetLiveDelaySeconds);
        }
        setStats(`Buffer: ${buffered.toFixed(1)}s | Time: ${video.currentTime.toFixed(1)}s | Lag: ${liveLag.toFixed(1)}s`);
      }
    };

    video?.addEventListener("timeupdate", updateStats);
    video?.addEventListener("waiting", updateStats);
    video?.addEventListener("stalled", updateStats);
    statsTimerRef.current = setInterval(updateStats, 1000);
    void startStreamAndAttach();

    return () => {
      mounted = false;
      video?.removeEventListener("timeupdate", updateStats);
      video?.removeEventListener("waiting", updateStats);
      video?.removeEventListener("stalled", updateStats);
      clearStatsTimer();
      cleanupHls();
    };
  }, [vehicleId, channel, fallbackVehicleIds]);

  const isStreaming = status === "Streaming";

  return (
    <div className="rounded-lg bg-slate-800 p-4 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-teal-400">{vehicleName || `${vehicleId} - Ch ${channel}`}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isStreaming ? "text-green-400" : error ? "text-red-400" : "text-yellow-400"}`}>
            {status}
          </span>
          {onStop && (
            <button
              onClick={onStop}
              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="relative aspect-video w-full rounded bg-slate-900">
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          className="h-full w-full rounded bg-black"
          style={{ display: isStreaming ? "block" : "none" }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <AlertCircle className="mx-auto mb-2 h-12 w-12" />
              <p className="text-sm">Stream not available</p>
              <p className="mt-1 text-xs">Vehicle may be offline</p>
            </div>
          </div>
        )}
        {!error && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Loader2 className="mx-auto mb-2 h-12 w-12 animate-spin" />
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 font-mono text-xs text-gray-400">{stats}</div>
    </div>
  );
}
