import { Monitor } from '@prisma/client';
import { checkers } from './index';
import { MonitorCheckResult } from './types';

export interface CheckResult extends Omit<MonitorCheckResult, 'ping'> {
  ping?: number | null;
  details?: Record<string, unknown>;
}

// 执行监控检查
export async function executeMonitorCheck(monitor: Monitor): Promise<CheckResult> {
  try {
    let result: CheckResult;
    const config = typeof monitor.config === 'string' 
      ? JSON.parse(monitor.config) 
      : monitor.config;

    switch (monitor.type) {
      case 'http':
        result = await checkers.http({ url: config.url, ...config });
        break;
      case 'https-cert':
        result = await checkers["https-cert"]({ url: config.url, ...config });
        break;
      case 'keyword':
        result = await checkers.keyword({ url: config.url, keyword: config.keyword, ...config });
        break;
      case 'port':
        result = await checkers.port({ hostname: config.hostname, port: config.port });
        break;
      case 'mysql':
      case 'redis':
        result = await checkers.database(monitor.type, { 
          hostname: config.hostname, 
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.database,
          query: config.query
        });
        break;
      case 'push':
        result = await checkers.push({ 
          token: config.token,
          pushInterval: config.pushInterval || monitor.interval
        });
        break;
      case 'icmp':
        result = await checkers.icmp({ 
          hostname: config.hostname,
          packetCount: config.packetCount,
          maxPacketLoss: config.maxPacketLoss,
          maxResponseTime: config.maxResponseTime
        });
        break;
      default:
        return {
          status: 0,
          message: `不支持的监控类型: ${monitor.type}`
        };
    }

    // 如果配置了重试次数且检查失败，进行重试
    if (result.status === 0 && monitor.retries > 0) {
      for (let i = 0; i < monitor.retries; i++) {
        // 等待重试间隔时间
        await new Promise(resolve => setTimeout(resolve, monitor.retryInterval * 1000));
        
        const retryResult = await executeMonitorCheck({
          ...monitor,
          retries: 0 // 防止重试时再次重试
        });

        if (retryResult.status === 1) {
          return {
            ...retryResult,
            message: `重试成功 (${i + 1}/${monitor.retries}): ${retryResult.message}`
          };
        }
      }

      return {
        ...result,
        message: `重试${monitor.retries}次后仍然失败: ${result.message}`
      };
    }

    return result;
  } catch (error) {
    return {
      status: 0,
      message: `检查执行出错: ${error instanceof Error ? error.message : String(error)}`
    };
  }
} 