import { createVisitorHandlers } from '../../../../server/visitors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return createVisitorHandlers({ env: process.env }).post(request); }
