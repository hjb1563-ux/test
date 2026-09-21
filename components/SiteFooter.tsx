import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function SiteFooter() {
  return <footer className="siteFooter printHide">
    <div className="footerMain"><div><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><p>좋은 욕실은, 나를 아는 선택에서.<br />리모델링을 준비하는 당신의 첫 번째 가이드.</p></div>
      <nav aria-label="하단 메뉴"><Link href="/design">내 욕실 만들기 <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/guide">리모델링 가이드 <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/guide/glossary">욕실 용어 사전 <ArrowUpRight size={16} aria-hidden="true" /></Link></nav>
    </div><div className="footerEnd"><span>© BATH DESIGNER</span><span>A considered space. A better everyday.</span></div>
  </footer>;
}
