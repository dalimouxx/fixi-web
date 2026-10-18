import { NextRequest, NextResponse } from 'next/server';

const unsafe = new Set(['POST','PUT','PATCH','DELETE']);

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/') && unsafe.has(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      try {
        const o = new URL(origin);
        const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
        if (forwardedHost && o.host !== forwardedHost) {
          return NextResponse.json({ error: 'Origine de requête refusée' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Origine de requête invalide' }, { status: 403 });
      }
    }
  }
  if (req.nextUrl.pathname.startsWith('/app/')) {
    // Recompute the route in the server layout rather than trusting a client header.
    const headers = new Headers(req.headers);
    headers.set('x-fixi-path', req.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*', '/app/:path*'] };
