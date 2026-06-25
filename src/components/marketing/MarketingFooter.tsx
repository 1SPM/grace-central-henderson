import { Check } from 'lucide-react';
import { DemoCtaLink } from './DemoCtaLink';

export function MarketingFooter() {
  return (
    <footer className="border-t border-central-line bg-central-canvas mt-8">
      <div className="central-container py-10">
        <div className="grid sm:grid-cols-4 gap-8 mb-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-[var(--radius-card)] bg-central-red text-central-white text-xs font-bold flex items-center justify-center font-brand">
                G
              </span>
              <span className="font-brand font-bold">GRACE</span>
            </div>
            <p className="text-sm text-central-grey max-w-sm leading-relaxed font-web">
              The platform for churches that want to spend less time on paperwork
              and more time with their people.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-central-grey mb-3 font-web font-semibold">
              Product
            </h4>
            <ul className="space-y-2 text-sm font-web">
              <li>
                <a href="/pricing" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Pricing
                </a>
              </li>
              <li>
                <DemoCtaLink href="/signup" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Start trial
                </DemoCtaLink>
              </li>
              <li>
                <DemoCtaLink href="/sign-in" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Sign in
                </DemoCtaLink>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-central-grey mb-3 font-web font-semibold">
              Company
            </h4>
            <ul className="space-y-2 text-sm font-web">
              <li>
                <a href="mailto:support@grace-crm.app" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Support
                </a>
              </li>
              <li>
                <a href="mailto:sales@grace-crm.app" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Sales
                </a>
              </li>
              <li>
                <a href="/terms" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Terms
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-central-black/80 hover:text-central-black transition-[color] duration-[180ms]">
                  Privacy
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-central-line flex flex-wrap items-center justify-between gap-3 text-xs text-central-grey font-web">
          <span>© {new Date().getFullYear()} Virtual Worship Solutions Inc.</span>
          <span className="flex items-center gap-1">
            <Check size={12} className="text-emerald-600" />
            SOC 2 Type II in progress · GDPR DPA available on request
          </span>
        </div>
      </div>
    </footer>
  );
}
