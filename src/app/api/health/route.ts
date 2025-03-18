import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check database connection by executing a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if AppSetting table is accessible
    let appSettingTableAvailable = false;
    try {
      // Try to count entries in AppSetting table
      await prisma.appSetting.count();
      appSettingTableAvailable = true;
    } catch (err) {
      console.error('AppSetting table check failed:', err);
      appSettingTableAvailable = false;
    }
    
    // Return successful health check response
    return NextResponse.json(
      { 
        status: 'ok',
        database: 'connected',
        appSettingTableAvailable,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    
    // Return error response
    return NextResponse.json(
      { 
        status: 'error',
        database: 'disconnected',
        appSettingTableAvailable: false,
        timestamp: new Date().toISOString(),
        message: 'Application is running but database connection failed',
        environment: process.env.NODE_ENV || 'unknown'
      },
      { status: 503 }
    );
  }
} 