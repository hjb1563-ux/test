import Link from 'next/link';
import { ArrowRight, Hammer, LayoutPanelTop, ShowerHead, Sparkles, type LucideIcon } from 'lucide-react';

type Guide = { slug: string; title: string; text: string; Icon: LucideIcon };
const guides: Guide[] = [
  { slug: 'demolition', title: '철거 vs 덧방', text: '기존 타일 위에 시공할지, 모두 철거할지 판단하는 법', Icon: Hammer },
  { slug: 'tile', title: '타일 가이드', text: '규격·소재·마감에 따라 달라지는 욕실의 인상', Icon: LayoutPanelTop },
  { slug: 'sink', title: '세면대 가이드', text: '사용성과 수납, 청소를 함께 고려하는 선택', Icon: Sparkles },
  { slug: 'partition', title: '파티션 가이드', text: '샤워 공간을 나누는 가장 실용적인 방법', Icon: ShowerHead },
  { slug: 'jendai', title: '젠다이 가이드', text: '욕실 물품을 깔끔하게 정리하는 선반 구조', Icon: LayoutPanelTop },
];

export default function Guide() { return <main><nav className="nav"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><Link className="navCta" href="/design">욕실 만들기</Link></nav><section className="pageHero"><div className="eyebrow">RENOVATION GUIDE</div><h1>알고 고르면,<br /><em>욕실이 더 쉬워집니다.</em></h1><p>처음 보는 단어도 부담 없이. 내 상황에 맞는 선택 기준부터 알아보세요.</p></section><section className="guideGrid">{guides.map(({ slug, title, text, Icon }) => <Link href={`/guide/${slug}`} className="guideCard" key={slug}><Icon /><span>BEGINNER GUIDE</span><h3>{title}</h3><p>{text}</p><ArrowRight size={18} /></Link>)}</section></main>; }
