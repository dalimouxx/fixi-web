import { manifestResponse } from '@/lib/pwa';

export const dynamic = 'force-static';
export function GET() { return manifestResponse('control'); }
