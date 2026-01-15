/**
 * Giving QR Code Generator Component
 *
 * Generates QR codes that link to the church's online giving page.
 * Supports different funds and custom amounts.
 */

import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import QRCode from 'qrcode';
import { Download, Copy, Check, QrCode, DollarSign, Printer } from 'lucide-react';

interface GivingQRCodeProps {
  givingPageUrl: string;
  churchName: string;
  funds?: { id: string; name: string }[];
}

export function GivingQRCode({ givingPageUrl, churchName, funds = [] }: GivingQRCodeProps) {
  const [selectedFund, setSelectedFund] = useState<string>('');
  const [suggestedAmount, setSuggestedAmount] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const canvasRef = useRef<HTMLDivElement>(null);

  // Build the URL with optional parameters
  const buildUrl = () => {
    const url = new URL(givingPageUrl);
    if (selectedFund) {
      url.searchParams.set('fund', selectedFund);
    }
    if (suggestedAmount) {
      url.searchParams.set('amount', suggestedAmount);
    }
    return url.toString();
  };

  const qrUrl = buildUrl();

  // Size mapping
  const sizeMap = {
    small: 128,
    medium: 200,
    large: 300,
  };

  const qrPixelSize = sizeMap[qrSize];

  // Download QR code as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a new canvas with white background and padding
    const paddedCanvas = document.createElement('canvas');
    const padding = 20;
    paddedCanvas.width = canvas.width + padding * 2;
    paddedCanvas.height = canvas.height + padding * 2 + 40; // Extra space for text

    const ctx = paddedCanvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);

    // Draw QR code
    ctx.drawImage(canvas, padding, padding);

    // Add text below
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Give to ${churchName}`, paddedCanvas.width / 2, canvas.height + padding + 25);

    if (selectedFund) {
      ctx.font = '12px Arial';
      ctx.fillStyle = '#6b7280';
      const fundName = funds.find((f) => f.id === selectedFund)?.name || selectedFund;
      ctx.fillText(fundName, paddedCanvas.width / 2, canvas.height + padding + 42);
    }

    // Download
    const link = document.createElement('a');
    const fundSuffix = selectedFund ? `-${selectedFund}` : '';
    link.download = `giving-qr-code${fundSuffix}.png`;
    link.href = paddedCanvas.toDataURL('image/png');
    link.click();
  };

  // Copy URL to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Print QR code
  const handlePrint = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const fundName = selectedFund
      ? funds.find((f) => f.id === selectedFund)?.name || selectedFund
      : 'General';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Giving QR Code - ${churchName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 2px solid #e5e7eb;
              border-radius: 16px;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 24px;
              color: #111827;
            }
            .fund {
              color: #6b7280;
              margin-bottom: 24px;
            }
            img {
              display: block;
              margin: 0 auto 24px;
            }
            .instructions {
              color: #6b7280;
              font-size: 14px;
            }
            @media print {
              .container {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Give to ${churchName}</h1>
            <p class="fund">${fundName}</p>
            <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
            <p class="instructions">Scan with your phone's camera to give online</p>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <QrCode className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Giving QR Codes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate QR codes for bulletins, screens, and cards
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Options */}
        <div className="space-y-4">
          {/* Fund Selection */}
          {funds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fund (optional)
              </label>
              <select
                value={selectedFund}
                onChange={(e) => setSelectedFund(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                <option value="">General Giving</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Suggested Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Suggested Amount (optional)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={suggestedAmount}
                onChange={(e) => setSuggestedAmount(e.target.value)}
                placeholder="Leave blank for any amount"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Size Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Size
            </label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setQrSize(size)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                    qrSize === size
                      ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* URL Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={qrUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
              />
              <button
                onClick={handleCopy}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* QR Code Preview */}
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
          <div ref={canvasRef} className="bg-white p-4 rounded-lg shadow-sm">
            <QRCodeCanvas
              value={qrUrl}
              size={qrPixelSize}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
            Give to {churchName}
            {selectedFund && (
              <span className="block text-xs text-gray-500">
                {funds.find((f) => f.id === selectedFund)?.name || selectedFund}
              </span>
            )}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Quick Sizes for Common Uses */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Download for Common Uses
        </h3>
        <div className="flex flex-wrap gap-2">
          <QuickDownloadButton
            label="Bulletin (1 inch)"
            size={96}
            url={qrUrl}
            churchName={churchName}
            fundName={funds.find((f) => f.id === selectedFund)?.name}
          />
          <QuickDownloadButton
            label="Slide (3 inch)"
            size={288}
            url={qrUrl}
            churchName={churchName}
            fundName={funds.find((f) => f.id === selectedFund)?.name}
          />
          <QuickDownloadButton
            label="Poster (6 inch)"
            size={576}
            url={qrUrl}
            churchName={churchName}
            fundName={funds.find((f) => f.id === selectedFund)?.name}
          />
        </div>
      </div>
    </div>
  );
}

// Quick download button for specific sizes
function QuickDownloadButton({
  label,
  size,
  url,
  churchName,
  fundName,
}: {
  label: string;
  size: number;
  url: string;
  churchName: string;
  fundName?: string;
}) {
  const handleDownload = async () => {
    // Create off-screen canvas for QR code
    const qrCanvas = document.createElement('canvas');

    try {
      await QRCode.toCanvas(qrCanvas, url, { width: size, margin: 0 });

      // Create final canvas with padding and text
      const padding = 20;
      const canvas = document.createElement('canvas');
      canvas.width = size + padding * 2;
      canvas.height = size + padding * 2 + 40;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR code
      ctx.drawImage(qrCanvas, padding, padding);

      // Add text
      ctx.fillStyle = '#374151';
      ctx.font = `bold ${Math.max(12, size / 16)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`Give to ${churchName}`, canvas.width / 2, size + padding + 25);

      if (fundName) {
        ctx.font = `${Math.max(10, size / 20)}px Arial`;
        ctx.fillStyle = '#6b7280';
        ctx.fillText(fundName, canvas.width / 2, size + padding + 42);
      }

      // Download
      const link = document.createElement('a');
      link.download = `giving-qr-${label.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {label}
    </button>
  );
}
