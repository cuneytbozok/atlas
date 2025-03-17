import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Test database connection
    const dbStatus = await prisma.$queryRaw`SELECT 1 as result`;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus ? "connected" : "error",
    });
  } catch (error) {
    console.error("Health check error:", error);
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
} 