-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assistantId" TEXT,
ADD COLUMN     "vectorStoreId" TEXT;

-- CreateTable
CREATE TABLE "VectorStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openaiVectorStoreId" TEXT,
    "configuration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VectorStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VectorStore_openaiVectorStoreId_key" ON "VectorStore"("openaiVectorStoreId");

-- CreateIndex
CREATE INDEX "VectorStore_openaiVectorStoreId_idx" ON "VectorStore"("openaiVectorStoreId");

-- CreateIndex
CREATE INDEX "Project_vectorStoreId_idx" ON "Project"("vectorStoreId");

-- CreateIndex
CREATE INDEX "Project_assistantId_idx" ON "Project"("assistantId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_vectorStoreId_fkey" FOREIGN KEY ("vectorStoreId") REFERENCES "VectorStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
