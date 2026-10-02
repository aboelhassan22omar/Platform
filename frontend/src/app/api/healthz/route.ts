/**
 * Liveness probe for the frontend container.
 * Deliberately dependency-free: it answers whether Next.js itself is serving,
 * not whether the API is reachable.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
}
