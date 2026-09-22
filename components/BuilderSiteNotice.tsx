export default function BuilderSiteNotice({ placement }: { placement: 'mobile' | 'sidebar' }) {
  return <aside className={`builderSiteNotice builderSiteNotice--${placement}`} aria-label="현장 확인 안내">
    <h3>현장 확인 안내</h3>
    <p>일부 선택 항목은 현장 상태와 업체 실측에 따라 최종 시공 가능 여부가 달라질 수 있습니다.</p>
    <style>{`
      .design .builderSiteNotice{padding:13px;border:1px solid #e5ded3;border-radius:10px;background:#f7f3ec}
      .design .builderSiteNotice h3{margin:0 0 6px;color:#514b43;font-size:13px;font-weight:600;line-height:1.4}
      .design .builderSiteNotice p{margin:0;color:#716b63;font-size:12px;font-weight:400;line-height:1.5;overflow-wrap:anywhere}
      .design .builderSiteNotice--sidebar{display:block;margin:12px 0}
      .design .builderSiteNotice--mobile{display:none}
      @media(max-width:1000px){
        .design .builderSiteNotice--sidebar{display:none}
        .design .builderSiteNotice--mobile{display:block;margin:0 0 20px}
      }
    `}</style>
  </aside>;
}
