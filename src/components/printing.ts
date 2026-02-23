import { sanitizeHtml } from '../utils/security';

export function buildPrintableDocument(contentHtml: string): string {
  const sanitizedContent = sanitizeHtml(contentHtml);

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRACE CRM Report</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline';">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              color: #1f2937;
            }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 16px 0 8px; color: #4f46e5; }
            p.subtitle { color: #6b7280; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
            .badge-blue { background: #dbeafe; color: #1e40af; }
            .badge-green { background: #dcfce7; color: #166534; }
            .badge-amber { background: #fef3c7; color: #92400e; }
            .total-row { font-weight: 600; background: #f9fafb; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          ${sanitizedContent}
        </body>
      </html>
    `;
}
