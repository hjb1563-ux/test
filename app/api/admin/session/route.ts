import { createVisitorAdmin } from '../../../../server/visitor-admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return createVisitorAdmin({ env: process.env }).login(request); }
export async function DELETE(request: Request) { return createVisitorAdmin({ env: process.env }).logout(request); }
