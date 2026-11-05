import VisitorAdminPanel from '../../../components/VisitorAdminPanel';
import { adminConfigured } from '../../../server/visitor-admin';
export const dynamic = 'force-dynamic';
export const metadata = { title: '관리자 로그인 | BATH DESIGNER', robots: { index: false, follow: false } };
export default function Page() { return <VisitorAdminPanel login configured={adminConfigured(process.env)} />; }
