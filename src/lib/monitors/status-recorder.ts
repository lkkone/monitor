import { prisma } from '@/lib/prisma';
import { Monitor } from '@prisma/client';
import { CheckResult } from './checker';
import { generateUltraCompactId } from '../utils/ultra-compact-id';
import { generateCompactMessage } from '../utils/compact-message';

interface RecordStatusParams {
  monitorId: string;
  status: number;
  message: string;
  ping?: number;
  details?: Record<string, unknown>;
  monitorType?: string;
}

export async function recordMonitorStatus(params: RecordStatusParams) {
  const { monitorId, status, message, ping, details, monitorType } = params;

  try {
    // 使用7位超紧凑ID和消息优化存储：正常状态message为null，错误状态保留详细信息
    const ultraCompactId = generateUltraCompactId();
    const compactMessage = generateCompactMessage(status, message, ping);

    // 创建状态记录
    const record = await prisma.monitorStatus.create({
      data: {
        id: ultraCompactId,
        monitorId,
        status,
        message: compactMessage,
        ping,
        details: details ? JSON.stringify(details) : null
      }
    });

    // 更新监控项的最新状态
    await prisma.monitor.update({
      where: { id: monitorId },
      data: {
        lastCheckAt: new Date(),
        lastStatus: status,
        lastMessage: message,
        lastPing: ping
      }
    });

    return record;
  } catch (error) {
    console.error('记录监控状态失败:', error);
    throw error;
  }
}

// 清理历史记录
export async function cleanupStatusHistory(days: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    const result = await prisma.monitorStatus.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`已清理 ${result.count} 条历史记录`);
    return result.count;
  } catch (error) {
    console.error('清理历史记录失败:', error);
    throw error;
  }
} 