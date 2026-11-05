'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import styles from './VisitorAdminPanel.module.css';

export default function VisitorPasswordSetup({ configured }: { configured: boolean }) {
  const link = useRef<{ tokenHash: string; type: string } | { code: string } | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    function receive(changed = false) {
      const query = new URLSearchParams(window.location.search);
      const hasQuery = !!window.location.search;
      const code = query.get('code');
      if (!changed && !window.location.hash && !hasQuery) return;
      const hasHash = !!window.location.hash;
      const hash = new URLSearchParams(window.location.hash.slice(1));
      // Fragments never reach HTTP logs. Remove immediately; no browser storage.
      window.history.replaceState(window.history.state, '', '/admin/setup-password');
      link.current = null; setReady(false); setMessage('');
      const tokenHash = hash.get('token_hash'), type = hash.get('type');
      if (code && query.size === 1 && query.getAll('code').length === 1 && !hasHash && /^[A-Za-z0-9_-]{16,512}$/.test(code)) {
        link.current = { code }; setReady(true);
      } else if (!hasQuery && hash.getAll('token_hash').length === 1 && hash.getAll('type').length === 1 &&
        !hash.has('access_token') && !hash.has('refresh_token') && tokenHash && /^[a-f0-9]{56,128}$/i.test(tokenHash) && ['invite','recovery'].includes(type ?? '')) {
        link.current = { tokenHash, type: type! }; setReady(true);
      } else setMessage('이 링크는 사용할 수 없거나 만료되었습니다. 아래에서 새 복구 메일을 요청해주세요.');
    }
    const onHashChange = () => receive(true);
    receive(); window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  async function setup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    const password = fields.get('password'), confirmation = fields.get('confirmation');
    if (password !== confirmation) { setMessage('비밀번호가 서로 일치하지 않습니다.'); return; }
    if (!link.current) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/password', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Bath-Admin': '1' }, body: JSON.stringify({ ...link.current, password, confirmation }) });
      if (!response.ok) {
        if (response.status !== 429) { link.current = null; setReady(false); }
        throw new Error(response.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해주세요.' : '설정하지 못했습니다. 링크가 만료되었거나 비밀번호 정책을 충족하지 않을 수 있습니다. 새 복구 메일을 요청해주세요.');
      }
      link.current = null; window.location.replace('/admin/login');
    } catch (e) { setMessage(e instanceof Error ? e.message : '설정하지 못했습니다. 새 복구 메일을 요청해주세요.'); }
    finally { form.reset(); setBusy(false); }
  }
  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, email = new FormData(form).get('email');
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/password/recovery', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Bath-Admin': '1' }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error(response.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해주세요.' : '메일을 요청하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setMessage('주소가 등록된 관리자 계정과 일치하면 복구 메일이 발송됩니다. 메일의 새 링크를 열어주세요.');
    } catch (e) { setMessage(e instanceof Error ? e.message : '메일을 요청하지 못했습니다.'); }
    finally { form.reset(); setBusy(false); }
  }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/admin/login">BATH DESIGNER</Link><span>관리자</span></header>
    <section className={styles.content}>
      <p className={styles.eyebrow}>ACCOUNT RECOVERY</p><h1>관리자 비밀번호 설정</h1>
      {!configured && <p>관리자 인증 설정이 준비되지 않았습니다.</p>}
      {ready ? <>
        <p>새 비밀번호를 입력해주세요. 링크의 유효성은 설정할 때 확인합니다.</p>
        <form className={styles.form} onSubmit={setup}>
          <label htmlFor="setup-password">새 비밀번호 · 12자 이상</label><input id="setup-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={!configured || busy} />
          <label htmlFor="setup-confirmation">비밀번호 확인</label><input id="setup-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={!configured || busy} />
          <button type="submit" disabled={!configured || busy}>{busy ? '설정 중…' : '비밀번호 설정'}</button>
        </form>
      </> : <>
        <p>사용한 초대 링크나 만료된 링크 대신 기존 계정의 복구 메일을 요청해주세요. 계정은 새로 만들지 않습니다.</p>
        <form className={styles.form} onSubmit={recover}>
          <label htmlFor="recovery-email">관리자 이메일</label><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={!configured || busy} />
          <button type="submit" disabled={!configured || busy}>{busy ? '요청 중…' : '복구 메일 받기'}</button>
        </form>
      </>}
      <p className={styles.message} role="status" aria-live="polite">{message}</p><Link href="/admin/login">관리자 로그인으로 돌아가기</Link>
    </section>
  </main>;
}
