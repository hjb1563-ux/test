export default function BuilderSiteNotice({ placement }: { placement: 'mobile' | 'sidebar' }) {
  return <details className={`builderSiteNotice builderSiteNotice--${placement}`}>
    <summary>ⓘ 일부 항목은 현장 확인이 필요합니다. <span>자세히</span></summary>
    <p>현장 상태와 업체 실측에 따라 최종 시공 가능 여부가 달라질 수 있습니다.</p>
  </details>;
}
