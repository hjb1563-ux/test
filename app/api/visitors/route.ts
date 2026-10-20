import { createVisitorHandlers } from '../../../server/visitors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return createVisitorHandlers({ env: process.env }).get(request); }
