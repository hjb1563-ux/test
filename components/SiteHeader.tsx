import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return <nav className={`nav siteNav${overlay ? ' siteNav--overlay' : ''}`} aria-label="주 메뉴">
    <Link href="/" className="brand" aria-label="BATH DESIGNER 홈">BATH <i>DESIGNER</i></Link>
    <div><Link href="/guide">리모델링 가이드</Link><Link className="navCta" href="/design">내 욕실 만들기 <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
  </nav>;
}
