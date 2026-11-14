'use client';

import Link from 'next/link';
import { FEATURE_FLAGS } from '../config/features';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Instagram } from 'lucide-react';

export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname === '/design') return null;
  return <footer className="siteFooter printHide">
    <div className="footerMain"><div><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><p>좋은 욕실은, 나를 아는 선택에서.<br />리모델링을 준비하는 당신의 첫 번째 가이드.</p></div>
      <nav aria-label="하단 메뉴"><Link href="/design">내 욕실 만들기 <ArrowUpRight size={16} aria-hidden="true" /></Link>{FEATURE_FLAGS.remodelingGuide && (<><Link href="/guide">리모델링 가이드 <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/guide/glossary">욕실 용어 사전 <ArrowUpRight size={16} aria-hidden="true" /></Link></>)}{pathname === '/' && <a className="footerContact" href="https://www.instagram.com/h_jayb1?exln=MXI4bGpqeHh1aWgyaA%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="홈페이지 문의 instagram : h_jayb1 (새 탭에서 열림)"><Instagram size={16} aria-hidden="true" /><span>홈페이지 문의 instagram : h_jayb1</span></a>}</nav>
    </div><div className="footerEnd"><span>© BATH DESIGNER</span><span>A considered space. A better everyday.</span></div>
  </footer>;
}
