import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  // 1. On récupère le token dans les cookies
  const token = request.cookies.get('token')?.value;

  // 2. On définit les routes publiques (celles accessibles sans login)
  const isPublicPage =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/register';

  // CAS A : Si l'utilisateur n'a PAS de token et essaie d'accéder à une page privée
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // CAS B : Si l'utilisateur A un token et essaie d'aller sur login/register
  if (token && isPublicPage) {
    return NextResponse.redirect(new URL('/homepage', request.url));
  }

  return NextResponse.next();
}

// 3. On définit sur quelles routes le middleware doit s'exécuter
export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - api (les routes d'api interne)
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico (icône du site)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
