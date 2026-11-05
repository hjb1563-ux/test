import { createVisitorAdmin } from '../../../../server/visitor-admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return createVisitorAdmin({ env: process.env }).publicTotal(request); }
