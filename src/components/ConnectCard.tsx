import { useState, useRef } from 'react';
import { Church, Send, CheckCircle, User, Mail, Phone, MessageSquare, Users, Copy, Check, Download, Printer, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import QRCodeLib from 'qrcode';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { escapeHtml } from '../utils/security';

interface ConnectCardProps {
  churchName?: string;
  churchId: string;
  mode?: 'admin' | 'public';
  onSuccess?: () => void;
}

export function ConnectCard({ churchName = 'Our Church', churchId, mode = 'admin', onSuccess }: ConnectCardProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const { isCopied, copy: copyToClipboard } = useCopyToClipboard();
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const connectUrl = `${window.location.origin}/connect`;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    howDidYouHear: '',
    prayerRequest: '',
    interestedIn: [] as string[],
  });

  const interests = [
    { id: 'small-groups', label: 'Small Groups' },
    { id: 'volunteering', label: 'Volunteering' },
    { id: 'youth', label: 'Youth Ministry' },
    { id: 'kids', label: "Children's Ministry" },
    { id: 'music', label: 'Worship/Music' },
    { id: 'missions', label: 'Missions' },
  ];

  const toggleInterest = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interestedIn: prev.interestedIn.includes(id)
        ? prev.interestedIn.filter(i => i !== id)
        : [...prev.interestedIn, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/connect-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit. Please try again.');
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = async () => {
    try {
      const qrCanvas = document.createElement('canvas');
      await QRCodeLib.toCanvas(qrCanvas, connectUrl, { width: 512, margin: 0 });
      const padding = 20;
      const canvas = document.createElement('canvas');
      canvas.width = qrCanvas.width + padding * 2;
      canvas.height = qrCanvas.height + padding * 2 + 40;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrCanvas, padding, padding);
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Connect with ${churchName}`, canvas.width / 2, qrCanvas.height + padding + 28);
      const link = document.createElement('a');
      link.download = 'connect-card-qr.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Silently fail
    }
  };

  const handlePrintQR = () => {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const safeName = escapeHtml(churchName);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Connect Card QR - ${safeName}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:Arial,sans-serif}
      .container{text-align:center;padding:40px;border:2px solid #e5e7eb;border-radius:16px}h1{margin:0 0 8px;font-size:24px;color:#111827}
      .sub{color:#6b7280;margin-bottom:24px}img{display:block;margin:0 auto 24px}.instructions{color:#6b7280;font-size:14px}
      @media print{.container{border:none}}</style></head><body>
      <div class="container"><h1>Welcome to ${safeName}</h1><p class="sub">Scan to fill out a Connect Card</p>
      <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
      <p class="instructions">Point your phone's camera at this QR code</p></div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 100);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to {churchName}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Thank you for connecting with us. Someone from our team will reach out to you soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-gray-900 dark:to-indigo-950 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Church className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to {churchName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            We're so glad you're here! Fill out this card so we can connect with you.
          </p>
        </div>

        {/* Share Panel (admin only) */}
        {mode === 'admin' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 mb-6">
            <button
              type="button"
              onClick={() => setShareOpen(!shareOpen)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Share Connect Card</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">QR code, link, and print options</p>
                </div>
              </div>
              {shareOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {shareOpen && (
              <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* URL + Copy */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Shareable Link
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={connectUrl}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(connectUrl)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          title="Copy URL"
                        >
                          {isCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Share this link on lobby tablets, in emails, or project on screens during services.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadQR}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download QR
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintQR}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                    </div>
                  </div>

                  {/* QR Code Preview */}
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div ref={qrCanvasRef} className="bg-white p-3 rounded-lg shadow-sm">
                      <QRCodeCanvas
                        value={connectUrl}
                        size={180}
                        level="H"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                      Scan to open Connect Card
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form data-tutorial="connect-card-share" onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="John"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* How did you hear about us */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              How did you hear about us?
            </label>
            <select
              value={formData.howDidYouHear}
              onChange={(e) => setFormData(prev => ({ ...prev, howDidYouHear: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select one...</option>
              <option value="friend">Friend or Family</option>
              <option value="online">Online Search</option>
              <option value="social">Social Media</option>
              <option value="drive-by">Drove By</option>
              <option value="event">Community Event</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              I'm interested in learning more about:
            </label>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.interestedIn.includes(interest.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {interest.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prayer Request */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MessageSquare className="inline w-4 h-4 mr-1" />
              Prayer Request or Comments
            </label>
            <textarea
              value={formData.prayerRequest}
              onChange={(e) => setFormData(prev => ({ ...prev, prayerRequest: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Let us know how we can pray for you..."
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Your information is safe with us and will only be used to connect with you.
          </p>
        </form>
      </div>
    </div>
  );
}
