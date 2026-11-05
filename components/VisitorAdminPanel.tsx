'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { VisitorStatistics } from '../server/visitor-admin';
import styles from './VisitorAdminPanel.module.css';

export default function VisitorAdminPanel({ login = false, configured = true }: { login?: boolean; configured?: boolean }) {
  const [stats, setStats] = useState<VisitorStatistics | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function refresh() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/visitors', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { setStats(null); throw new Error(response.status === 401 || response.status === 403 ? '관리자 로그인이 필요합니다.' : '통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); }
      setStats(await response.json());
    } catch (e) { setStats(null); setError(e instanceof Error ? e.message : '통계를 불러오지 못했습니다.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!login) void refresh(); }, [login]);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget, fields = new FormData(form);
    try {
      const response = await fetch('/api/admin/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Bath-Admin': '1' }, body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }) });
      if (!response.ok) throw new Error(response.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해주세요.' : response.status === 503 ? '관리자 인증을 사용할 수 없습니다. 설정을 확인해주세요.' : '로그인할 수 없습니다. 계정 정보와 관리자 권한을 확인해주세요.');
      window.location.assign('/admin/visitors');
    } catch (e) { setError(e instanceof Error ? e.message : '로그인할 수 없습니다.'); }
    finally { const password = form.elements.namedItem('password'); if (password instanceof HTMLInputElement) password.value = ''; setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Bath-Admin': '1' } });
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도해주세요.');
      setStats(null); window.location.assign('/admin/login');
    } catch (e) { setError(e instanceof Error ? e.message : '로그아웃하지 못했습니다.'); setBusy(false); }
  }
  const cards = [['누적 방문자 수', stats?.total], ['오늘 방문자 수', stats?.today], ['최근 7일 방문자 수', stats?.last7], ['최근 30일 방문자 수', stats?.last30]] as const;
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">BATH DESIGNER</Link><span>관리자</span></header>
    <section className={styles.content}>
      <p className={styles.eyebrow}>VISITOR STATISTICS</p>
      <h1>{login ? '관리자 로그인' : '방문자 통계'}</h1>
      {login ? <>
        <p>등록된 관리자 계정으로 로그인해주세요.</p>
        {!configured && <p role="status">관리자 인증 설정이 준비되지 않았습니다.</p>}
        <form className={styles.form} onSubmit={signIn}>
          <label htmlFor="admin-email">이메일</label><input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={!configured || busy} />
          <label htmlFor="admin-password">비밀번호</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={!configured || busy} />
          <button type="submit" disabled={!configured || busy}>{busy ? '확인 중…' : '로그인'}</button>
        </form>
        <p><Link href="/admin/setup-password">처음 비밀번호 설정 / 비밀번호 찾기</Link></p>
      </> : <>
        <div className={styles.actions}><button onClick={refresh} disabled={busy}>{busy ? '불러오는 중…' : '새로고침'}</button><button onClick={signOut} disabled={busy}>로그아웃</button></div>
        <div className={styles.cards} aria-busy={busy}>{cards.map(([label, value]) => <article key={label}><h2>{label}</h2><strong>{value === undefined ? '—' : value.toLocaleString('ko-KR')}</strong></article>)}</div>
        <p>마지막 데이터 갱신: {stats ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(stats.refreshedAt)) : '조회 전'}</p>
        <p className={styles.definition}>한국 시간 기준 일별 고유 브라우저 수입니다. 누적·7일·30일 수치는 일별 합계이며, 같은 브라우저가 다른 날 방문하면 각각 포함됩니다. 최근 기간에는 오늘을 포함합니다. 쿠키 삭제·만료나 브라우저 변경 시 새 방문자로 집계될 수 있습니다.</p>
        <p className={styles.definition}>갱신 시각은 데이터 조회 시각입니다. 홈페이지에는 방문자 수를 공개하지 않습니다.</p>
      </>}
      <p role="status" aria-live="polite" className={styles.message}>{error}</p>
      {!login && error && <Link href="/admin/login">관리자 로그인으로 이동</Link>}
    </section>
  </main>;
}
