import type { LiveServiceCtaCounts } from '../../lib/services/liveService';

interface LiveServiceCTAPanelProps {
  ctaCounts: LiveServiceCtaCounts;
}

const CTAS = [
  {
    key: 'followJesus' as const,
    title: 'I Decided to Follow Jesus',
    button: 'Let Us Know',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=300&fit=crop',
    primary: true,
  },
  {
    key: 'getConnected' as const,
    title: 'Get Connected to a Group',
    button: 'Take a Next Step',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=300&fit=crop',
    primary: false,
  },
  {
    key: 'giveOnline' as const,
    title: 'Give Online',
    button: 'Give Now',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop',
    primary: false,
  },
];

export function LiveServiceCTAPanel({ ctaCounts }: LiveServiceCTAPanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CTAS.map(cta => (
        <div
          key={cta.key}
          className="relative rounded-2xl overflow-hidden min-h-[160px] flex flex-col justify-end"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cta.image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          <div className="relative p-5 text-center">
            <h3 className="text-white font-bold text-sm mb-3">{cta.title}</h3>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-white/60 uppercase tracking-wider">
                {ctaCounts[cta.key]} this service
              </span>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                  cta.primary
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-white/20 text-white backdrop-blur hover:bg-white/30'
                }`}
              >
                {cta.button}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
