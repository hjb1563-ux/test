import type { Metadata } from 'next';
import './globals.css';
import './guide.css';
import './design.css';
export const metadata: Metadata = { title: 'BATH DESIGNER', description: '나만의 욕실을 설계하는 가장 쉬운 방법' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html> }
