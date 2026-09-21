import type { Metadata } from 'next';
import './globals.css';
import './guide.css';
import './design.css';
import './editorial.css';
import './consultation.css';
import SiteFooter from '../components/SiteFooter';
export const metadata: Metadata = { title: 'BATH DESIGNER | 욕실 리모델링 준비', description: '시공 방식부터 타일, 욕조, 조명까지. 욕실 리모델링의 선택 기준을 살펴보고 나에게 맞는 선택 목록을 정리하세요.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}<SiteFooter /></body></html> }
