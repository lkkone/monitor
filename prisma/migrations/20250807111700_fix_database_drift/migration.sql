-- 添加 displayOrder 字段到 Monitor 表
ALTER TABLE "Monitor" ADD COLUMN "displayOrder" INTEGER;

-- 添加 defaultForNewMonitors 字段到 NotificationChannel 表
ALTER TABLE "NotificationChannel" ADD COLUMN "defaultForNewMonitors" BOOLEAN DEFAULT false; 