import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const healthData: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "unknown",
    dbConnectionDetails: {},
    appSettingTableAvailable: false,
    diagnostics: {}
  };

  try {
    // Test basic database connection
    console.log("Health check: testing database connection");
    try {
      const dbStatus = await prisma.$queryRaw`SELECT 1 as result`;
      healthData.database = "connected";
      healthData.dbConnectionDetails.basicQuery = true;
    } catch (dbErr) {
      console.error("Database connection error:", dbErr);
      healthData.database = "error";
      healthData.status = "error";
      healthData.dbConnectionDetails.basicQuery = false;
      healthData.dbConnectionDetails.error = dbErr instanceof Error ? dbErr.message : String(dbErr);
    }
    
    // Test if Prisma is initialized correctly
    try {
      healthData.diagnostics.prismaVersion = await prisma.$queryRaw`SELECT version()`;
      healthData.dbConnectionDetails.prismaInitialized = true;
    } catch (err) {
      console.error("Error getting database version:", err);
      healthData.dbConnectionDetails.prismaInitialized = false;
    }
    
    // Test if AppSetting table is available
    try {
      const count = await prisma.appSetting.count();
      healthData.appSettingTableAvailable = true;
      healthData.diagnostics.appSettingCount = count;
      console.log("Health check: AppSetting table available, count:", count);
    } catch (err) {
      console.error("Health check: AppSetting table error:", err);
      healthData.appSettingTableAvailable = false;
      healthData.diagnostics.appSettingError = err instanceof Error ? err.message : String(err);
    }
    
    // Get all model names for debugging
    try {
      // @ts-ignore - Access Prisma's internal properties to get model names
      const modelNames = Object.keys(prisma).filter(key => 
        !key.startsWith('$') && 
        !key.startsWith('_') && 
        typeof prisma[key] === 'object' && 
        prisma[key] !== null
      );
      
      healthData.diagnostics.availableModels = modelNames;
    } catch (err) {
      console.error("Error getting model names:", err);
    }
    
    return NextResponse.json(healthData);
  } catch (error) {
    console.error("Health check error:", error);
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
} 