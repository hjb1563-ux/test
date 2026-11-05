import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import VisitorAdminPanel from '../../../components/VisitorAdminPanel';
import { createVisitorAdmin } from '../../../server/visitor-admin';
export const dynamic = 'force-dynamic';
export const metadata = { title: '방문자 통계 | BATH DESIGNER', robots: { index: false, follow: false } };
export default async function Page() {
  const cookie = (await cookies()).toString();
  try {
    await createVisitorAdmin({ env: process.env }).authorize(new Request((process.env.VISITOR_ADMIN_ORIGIN || 'https://disabled.invalid') + '/admin/visitors', { headers: { Cookie: cookie } }));
  } catch { redirect('/admin/login'); }
  return <VisitorAdminPanel />;
}
