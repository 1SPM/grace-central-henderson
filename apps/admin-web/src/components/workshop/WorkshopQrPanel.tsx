import { useState } from 'react';
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react';

/**
 * QR/share panel for the workshop's mobile entry point, shown on
 * WorkshopEvidencePage so a staff member running the workshop can pull
 * it up on the desktop and display it for the room.
 *
 * Reuses the exact QR pattern already proven in
 * apps/member-web/public/tenants/central-henderson/member-portal.html's
 * "Link to Mobile" tab (initMobileSharePanel()): the api.qrserver.com
 * third-party service, a copyable URL input, and an "Open in New Tab"
 * link. Only the foreground color changes (admin-web's ink color
 * instead of Central Henderson's brand red), since this panel is
 * tenant-agnostic.
 *
 * `workshopUrl` is null for any church without a known member-web host
 * (everyone except Central Henderson today — see
 * api/workshop/_shared.ts's resolveWorkshopUrlForChurch). That's an
 * expected, correct state, not an error — rendered as a quiet inline
 * note rather than a broken image.
 */
export function WorkshopQrPanel({ workshopUrl }: { workshopUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!workshopUrl) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5 text-sm text-gray-500 dark:text-dark-400">
        Workshop QR code isn't available for this church yet — it needs a known Member Portal domain.
      </div>
    );
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(workshopUrl)}&bgcolor=ffffff&color=1a1a1a`;

  function handleCopy() {
    navigator.clipboard.writeText(workshopUrl!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-dark-50 mb-3">
        <QrCode size={15} /> Scan to join the workshop
      </div>
      <div className="flex items-start gap-4 flex-wrap">
        <img src={qrSrc} alt="QR code linking to the workshop" width={120} height={120} className="rounded-lg border border-gray-200 dark:border-dark-700" />
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={workshopUrl}
              className="flex-1 text-xs font-mono px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 text-gray-700 dark:text-dark-300"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-dark-700 flex items-center gap-1 text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-900"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <a
            href={workshopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline"
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
        </div>
      </div>
    </div>
  );
}
