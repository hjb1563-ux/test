export default function BuilderSiteNotice({ placement }: { placement: 'mobile' | 'sidebar' }) {
  return <div className={`builderSiteNotice builderSiteNotice--${placement}`}>
    <span className="builderSiteNoticeIcon" aria-hidden="true">ⓘ</span>
    <p>현장 상태에 따라 최종 시공 가능 여부가 달라집니다</p>
  </div>;
}
