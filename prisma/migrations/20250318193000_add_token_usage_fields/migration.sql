-- Add token usage fields to Message table
ALTER TABLE "Message" 
ADD COLUMN "runId" TEXT,
ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER;

-- Add token usage fields to Thread table
ALTER TABLE "Thread" 
ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER;

-- Add token usage fields to Project table
ALTER TABLE "Project" 
ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER; 