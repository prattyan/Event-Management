import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCcw } from 'lucide-react';

interface ScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Delay initialization slightly to ensure DOM is ready and previous streams are cleared
    const timer = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.type = 'square';

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const startScanner = async () => {
    if (!mountRef.current) return;

    // Cleanup existing instance if any
    if (scannerRef.current) {
      await stopScanner();
    }

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      };

      // Try environment first, then any camera
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            playBeep();
            onScan(decodedText);
            scanner.pause(true);
            setTimeout(() => {
              try {
                scanner.resume();
              } catch (e) {
                console.log("Scanner resume failed", e);
              }
            }, 2000);
          },
          () => { } // Error parsing
        );
      } catch (firstErr) {
        console.warn("Environment camera failed, trying fallback...", firstErr);
        // Fallback: try user camera or first available
        await scanner.start(
          { facingMode: "user" },
          config,
          (decodedText) => {
            playBeep();
            onScan(decodedText);
            scanner.pause(true);
            setTimeout(() => {
              try {
                scanner.resume();
              } catch (e) {
                console.log("Scanner resume failed", e);
              }
            }, 2000);
          },
          () => { }
        );
      }

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error("Scanner init error", err);
      let msg = `Camera access failed (${err?.name || 'Unknown error'}).`;

      if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
        msg = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err?.name === "NotFoundError") {
        msg = "No camera found on this device.";
      } else if (err?.name === "NotReadableError") {
        msg = "Camera is currently in use by another application.";
      } else if (err?.name === "OverconstrainedError") {
        msg = "Could not find a camera that meets the requirements.";
      } else if (err?.name === "SecurityError") {
        msg = "Camera access blocked. Ensure you are using HTTPS or localhost.";
      } else if (err?.message) {
        msg = `Camera error: ${err.message}`;
      }

      setError(msg);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 bg-slate-800">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-400" />
            Scan Ticket
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="relative aspect-square bg-black">
          <div id="qr-reader" ref={mountRef} className="w-full h-full"></div>

          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <RefreshCcw className="w-8 h-8 animate-spin mb-4" />
              <p>Starting camera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-6 text-center bg-slate-900/90 z-10">
              <Camera className="w-12 h-12 mb-4 opacity-50" />
              <p>{error}</p>
              <button
                onClick={startScanner}
                className="mt-6 px-4 py-2 bg-slate-800 rounded-lg text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {/* Overlay guide */}
          {isScanning && !error && (
            <div className="absolute inset-0 pointer-events-none border-2 border-orange-500/50 m-12 rounded-lg flex items-center justify-center">
              <div className="w-full h-0.5 bg-orange-500/50 animate-pulse"></div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-800 text-slate-300 text-sm text-center">
          Point camera at attendee's QR code
        </div>
      </div>
    </div>
  );
};

export default Scanner;
