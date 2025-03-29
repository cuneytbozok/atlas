-- Add token usage fields to Message table
ALTER TABLE "Message" 
ADD COLUMN IF NOT EXISTS "runId" TEXT,
ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER;

-- Add token usage fields to Thread table
ALTER TABLE "Thread" 
ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER;

-- Add token usage fields to Project table
ALTER TABLE "Project" 
ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER; 