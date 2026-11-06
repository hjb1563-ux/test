import type { Metadata } from 'next';
import './globals.css';
import './guide.css';
import './design.css';
import './editorial.css';
import './consultation.css';
import './builder-responsive.css';
import SiteFooter from '../components/SiteFooter';
import CloudflareAnalytics from '../components/CloudflareAnalytics';
import { cloudflareSiteToken } from '../data/cloudflare-analytics';
export const metadata: Metadata = { referrer: 'origin', title: 'BATH DESIGNER | 욕실 리모델링 준비', description: '시공 방식부터 타일, 욕조, 조명까지. 욕실 리모델링의 선택 기준을 살펴보고 나에게 맞는 선택 목록을 정리하세요.' };
export default function SiteDocument({ children, analytics = false, spa = false }: { children: React.ReactNode; analytics?: boolean; spa?: boolean }) {
  const token = analytics ? cloudflareSiteToken({NODE_ENV:process.env.NODE_ENV,VERCEL_ENV:process.env.VERCEL_ENV,CLOUDFLARE_WEB_ANALYTICS_TOKEN:process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN}) : null;
  return <html lang="ko"><body>{children}<SiteFooter />{token && <CloudflareAnalytics token={token} spa={spa} />}</body></html>;
}
