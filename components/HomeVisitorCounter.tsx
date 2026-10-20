'use client';
import { useEffect, useState } from 'react';
import { loadHomeVisitors } from '../data/home-visitors';
import styles from './HomeVisitorCounter.module.css';

export default function HomeVisitorCounter({ enabled }: { enabled: boolean }) {
  const [visitors, setVisitors] = useState<{ date: string; count: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const update = () => {
      if (document.visibilityState !== 'visible') return;
      void loadHomeVisitors(fetch, navigator.locks).then(result => { if (live) setVisitors(result); });
    };
    update();
    // Re-entry and Seoul midnight are handled without a fake real-time animation.
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { live = false; clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [enabled]);
  return <aside className={styles.counter} aria-label="오늘 방문자 — 브라우저 기준 추정치">
    <span className={styles.eyebrow}>TODAY’S VISITORS</span>
    <span>오늘 방문자</span>
    <span className={styles.value}>{visitors ? `${visitors.count.toLocaleString('ko-KR')}명` : '집계 준비 중'}</span>
  </aside>;
}
