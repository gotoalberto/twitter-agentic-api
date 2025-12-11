-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessTokenSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarding_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarding_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_registrations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bots_projectId_key" ON "bots"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "bots_username_key" ON "bots"("username");

-- CreateIndex
CREATE UNIQUE INDEX "bots_userId_key" ON "bots"("userId");

-- CreateIndex
CREATE INDEX "bots_projectId_idx" ON "bots"("projectId");

-- CreateIndex
CREATE INDEX "bots_username_idx" ON "bots"("username");

-- CreateIndex
CREATE UNIQUE INDEX "forwarding_configs_projectId_key" ON "forwarding_configs"("projectId");

-- CreateIndex
CREATE INDEX "forwarding_configs_projectId_idx" ON "forwarding_configs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_registrations_webhookId_key" ON "webhook_registrations"("webhookId");

-- CreateIndex
CREATE INDEX "webhook_registrations_projectId_idx" ON "webhook_registrations"("projectId");

-- CreateIndex
CREATE INDEX "webhook_registrations_webhookId_idx" ON "webhook_registrations"("webhookId");

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarding_configs" ADD CONSTRAINT "forwarding_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_registrations" ADD CONSTRAINT "webhook_registrations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
