import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import SiteHeader from '../components/SiteHeader';

const chapters = [
  { number: '01', title: '공간의 바탕', detail: '시공 방식 · 구조 · 방수', href: '/guide/demolition' },
  { number: '02', title: '재료의 감각', detail: '타일 · 천장 · 줄눈', href: '/guide/tile' },
  { number: '03', title: '생활의 방식', detail: '세면대 · 욕조 · 수전', href: '/guide/bathtub' },
  { number: '04', title: '마지막 디테일', detail: '조명 · 액세서리 · 문턱', href: '/guide/lighting' },
];

export default function Home() {
  return <main className="home">
    <SiteHeader overlay />
    <section className="homeHero" aria-labelledby="home-title">
      <Image className="homeHeroPhoto" src="/images/home/luxury-hotel-bathroom-hero.webp"
        alt="따뜻한 석재와 오크 세면대, 독립형 욕조가 어우러진 차분한 욕실 공간" fill sizes="100vw" preload />
      <div className="homeHeroShade" />
      <div className="homeHeroContent">
        <span className="kicker">BATHROOM PLANNING · A PERSONAL SPACE</span>
        <h1 id="home-title">내가 원하는 욕실을,<br /><span>더 선명하게.</span></h1>
        <p>시공 전에 무엇을 선택해야 하는지 하나씩 살펴보고,<br className="desktopBreak" /> 내가 원하는 욕실을 정리해보세요.</p>
        <div className="homeActions">
          <Link href="/design" className="button">내 욕실 만들기 <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link href="/guide" className="heroGuideLink">리모델링 가이드 <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="heroFootnote"><span>A quieter beginning, for your everyday.</span><a href="#considerations" aria-label="리모델링 준비 과정 알아보기">EXPLORE <ArrowDown size={15} aria-hidden="true" /></a></div>
    </section>
    <section className="homeConsider editorialSection" id="considerations">
      <div className="sectionHeading"><span className="kicker">01 / BEFORE YOU BEGIN</span><span className="sectionAside">공간을 바꾸기 전, 나의 기준부터.</span></div>
      <div className="introColumns"><h2>작은 공간에도,<br />많은 선택이 담깁니다.</h2><p>욕실 공사를 알아보기 전에 생각보다 많은 선택을 해야 합니다. 어려운 용어를 모두 알 필요는 없어요. 바탕이 되는 공정부터 매일 손이 닿는 디테일까지, 나에게 필요한 것부터 차근차근 살펴보세요.</p></div>
      <div className="chapterList">{chapters.map(chapter => <Link href={chapter.href} key={chapter.number}>
        <span className="chapterNumber">{chapter.number}</span><h3>{chapter.title}</h3><p>{chapter.detail}</p><ArrowUpRight size={20} aria-hidden="true" />
      </Link>)}</div>
    </section>
    <section className="homePlanner editorialSection">
      <figure className="plannerFigure"><Image src="/images/bathroom/showroom-v1.png" alt="석재 타일과 간접 조명으로 정돈된 욕실의 세면대와 샤워 공간" width={1672} height={941} sizes="(max-width: 800px) 100vw, 60vw" unoptimized />
        <figcaption><span>SPACE, MATERIAL & LIGHT</span><span>나의 일상에 맞는 공간</span></figcaption>
      </figure>
      <div className="plannerCopy"><span className="kicker">02 / YOUR BATHROOM, CONSIDERED</span><h2>취향은 구체적으로.<br />준비는 차분하게.</h2><p>타일의 분위기, 욕조의 형태, 빛의 위치.<br />하나씩 선택하며 내가 원하는 욕실을 그려보세요.</p><p>고른 요소는 사진과 함께 확인하고, 선택한 내용은 상담을 위한 목록으로 정리할 수 있습니다.</p><Link href="/design" className="editorialLink">내 욕실 만들기 시작하기 <ArrowUpRight size={20} aria-hidden="true" /></Link><div className="plannerNote"><b>17</b><span>개의 단계<br />나만의 선택 목록</span></div></div>
    </section>
    <section className="homeProcess editorialSection">
      <div className="sectionHeading"><span className="kicker">03 / HOW IT WORKS</span><span className="sectionAside">알아보고, 선택하고, 정리하세요.</span></div>
      <h2>막막했던 시작을,<br />세 단계로.</h2>
      <div className="processList">
        <article><span>01 — Understand</span><h3>알아보기</h3><p>복잡한 용어와 욕실의 구성 요소를<br />쉬운 말로 살펴보세요.</p></article>
        <article><span>02 — Select</span><h3>직접 선택하기</h3><p>마음에 드는 옵션을 고르고,<br />선택한 요소를 사진으로 확인하세요.</p></article>
        <article><span>03 — Prepare</span><h3>상담용 설계안 만들기</h3><p>선택한 내용을 정리해<br />업체 상담에 활용하세요.</p></article>
      </div>
    </section>
    <section className="homeGuide editorialSection">
      <div className="guideIntro"><span className="kicker">04 / THE RENOVATION JOURNAL</span><h2>알고 나면,<br />선택이 쉬워집니다.</h2><p>철거부터 마감까지, 욕실을 이루는 선택들을 살펴보세요. 낯선 용어와 옵션의 차이를 함께 정리했습니다.</p><Link href="/guide" className="editorialLink">리모델링 가이드 전체 보기 <ArrowUpRight size={20} aria-hidden="true" /></Link></div>
      <div className="journalList">
        <Link href="/guide/demolition"><span>01 / FOUNDATION</span><h3>철거 vs 덧방</h3><p>지금 공간의 상태에서 출발하기</p><ArrowUpRight size={24} aria-hidden="true" /></Link>
        <Link href="/guide/tile"><span>04 / MATERIAL</span><h3>타일</h3><p>크기, 색감, 표면이 만드는 분위기</p><ArrowUpRight size={24} aria-hidden="true" /></Link>
        <Link href="/guide/lighting"><span>13 / ATMOSPHERE</span><h3>조명 & 전기</h3><p>공간의 표정을 바꾸는 빛의 위치</p><ArrowUpRight size={24} aria-hidden="true" /></Link>
      </div>
    </section>
    <section className="homeWhy editorialSection"><span className="kicker">A BETTER CONVERSATION STARTS HERE</span><h2>좋은 상담의 시작은,<br />원하는 것을 아는 것.</h2><p>정답을 서두르지 않아도 괜찮아요.<br />모르는 항목은 남겨두고, 원하는 것은 기록하세요.<br />현장의 조건과 시공 가능 여부는 전문가와 함께 확인하면 됩니다.</p></section>
    <section className="homeFinal editorialSection"><div><span className="kicker">YOUR NEXT CHAPTER</span><h2>당신의 욕실은<br /><em>어떤 모습인가요?</em></h2></div><div><p>매일의 시작과 끝이 되는 공간.<br />지금, 나의 선택을 담아보세요.</p><Link href="/design" className="button">내 욕실 만들기 <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
  </main>;
}
