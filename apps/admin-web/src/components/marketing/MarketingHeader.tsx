import { DemoCtaLink } from './DemoCtaLink';

export function MarketingHeader() {
  return (
    <nav className="border-b border-central-line bg-central-white/90 backdrop-blur-md sticky top-0 z-50">
      <div className="central-container py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 text-central-black">
          <span
            className="w-9 h-9 rounded-[var(--radius-card)] bg-central-red text-central-white text-sm font-bold flex items-center justify-center font-brand"
            aria-hidden
          >
            G
          </span>
          <span className="font-brand text-lg font-bold tracking-tight">GRACE</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-6 font-web">
          <a href="/pricing" className="text-sm text-central-grey hover:text-central-black transition-[color] duration-[180ms]">
            Pricing
          </a>
          <a
            href="mailto:sales@grace-crm.app?subject=GRACE demo request"
            className="text-sm text-central-grey hover:text-central-black transition-[color] duration-[180ms] hidden sm:inline"
          >
            Talk to sales
          </a>
          <DemoCtaLink href="/sign-in" className="text-sm text-central-grey hover:text-central-black transition-[color] duration-[180ms]">
            Sign in
          </DemoCtaLink>
          <DemoCtaLink href="/signup" className="central-btn-primary !py-2 !px-4 !text-sm">
            Start trial
          </DemoCtaLink>
        </div>
      </div>
    </nav>
  );
}
