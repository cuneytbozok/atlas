// Type declarations for 'next/server' module
declare module 'next/server' {
  import { NextResponse } from 'next';
  
  export { NextResponse };
  
  export interface NextRequest extends Request {
    nextUrl: URL;
    geo?: {
      city?: string;
      country?: string;
      region?: string;
    };
    ip?: string;
    cookies: {
      get: (name: string) => { name: string; value: string } | undefined;
      getAll: () => { name: string; value: string }[];
      set: (name: string, value: string, options?: { path?: string; maxAge?: number }) => void;
      delete: (name: string) => void;
      has: (name: string) => boolean;
    };
  }
} 