import { notFound } from 'next/navigation';
// Preserve the Production baseline's 404 for unknown/admin/auth URLs.
// Future administrator routes must keep their own analytics-free root layout.
export default function UntrackedPage() { notFound(); }
