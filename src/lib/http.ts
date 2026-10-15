import { NextResponse } from 'next/server';
export function ok(data: unknown, init?: ResponseInit) { return NextResponse.json(data, init); }
export function bad(message: string, status=400, details?: unknown) { return NextResponse.json({error:message, details}, {status}); }
export function toNumber(v: unknown) { const n=Number(v); return Number.isFinite(n)?n:0; }
