import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, XCircle, ExternalLink, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export function MemberScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  const isSameOrigin = (url: string): boolean => {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const startScanner = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setResult(decodedText);
          stopScanner();

          // Auto-navigate for same-origin URLs
          if (isSameOrigin(decodedText)) {
            window.location.href = decodedText;
          }
        },
        () => {
          // QR code not detected in frame — ignore
        },
      );
    } catch (err) {
      setScanning(false);
      if (err instanceof Error && err.message.includes('Permission')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setError('Unable to access camera. Make sure you\'re using HTTPS and have a camera available.');
      }
    }
  }, [stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-600" />
          Scan QR Code
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Scan a QR code to check in, give, or connect
        </p>
      </div>

      {/* Scanner Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!scanning && !result && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tap below to open your camera and scan a QR code
            </p>
            <button
              onClick={startScanner}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto active:scale-95 transition-transform"
            >
              <Camera className="w-5 h-5" />
              Open Camera
            </button>
          </div>
        )}

        {/* Camera viewfinder */}
        <div
          ref={containerRef}
          id="qr-reader"
          className={scanning ? 'w-full' : 'hidden'}
          style={{ minHeight: scanning ? 300 : 0 }}
        />

        {scanning && (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Point your camera at a QR code
            </p>
            <button
              onClick={stopScanner}
              className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1 mx-auto"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">QR Code Detected</p>
          {isUrl(result) ? (
            <a
              href={result}
              target={isSameOrigin(result) ? '_self' : '_blank'}
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center gap-1 break-all"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              {result}
            </a>
          ) : (
            <p className="text-gray-700 dark:text-gray-300 text-sm break-all">{result}</p>
          )}
          <button
            onClick={() => {
              setResult(null);
              startScanner();
            }}
            className="mt-3 text-indigo-600 dark:text-indigo-400 text-sm font-medium"
          >
            Scan Another
          </button>
        </div>
      )}
    </div>
  );
}
