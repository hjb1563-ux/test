import VisitorPasswordSetup from '../../../components/VisitorPasswordSetup';
import { adminConfigured } from '../../../server/visitor-admin';
export const dynamic = 'force-dynamic';
export const metadata = { title: '관리자 비밀번호 설정 | BATH DESIGNER', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <VisitorPasswordSetup configured={adminConfigured(process.env)} />; }
