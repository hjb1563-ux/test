import Link from 'next/link';
import GuideIndex from '../../components/GuideIndex';
export default function GuidePage(){return <main><nav className="nav"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><div><Link href="/guide">리모델링 가이드</Link><Link className="navCta" href="/design">욕실 만들기</Link></div></nav><GuideIndex/></main>}
