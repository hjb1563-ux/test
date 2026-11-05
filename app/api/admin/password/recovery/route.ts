import { createVisitorPasswordHandlers } from '../../../../../server/visitor-password';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return createVisitorPasswordHandlers({ env: process.env }).recover(request); }
