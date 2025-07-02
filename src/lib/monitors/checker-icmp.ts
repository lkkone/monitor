import { MonitorIcmpConfig, MonitorCheckResult, MONITOR_STATUS } from './types';
import ping from 'ping';

/**
 * 执行ICMP Ping检查（单次执行，不包含重试逻辑）
 * @param config ICMP监控配置
 * @returns 检查结果
 */
async function checkIcmpSingle(config: MonitorIcmpConfig): Promise<MonitorCheckResult> {
  try {
    const { hostname, packetCount = 4, maxResponseTime } = config;
    
    // 使用ping库发送ICMP请求
    const pingOptions = {
      timeout: 10, // 10秒超时
      // 根据操作系统设置不同的参数
      extra: process.platform === 'win32' ? 
        ['-n', packetCount.toString()] : 
        ['-c', packetCount.toString()]
    };
    
    const pingResult = await ping.promise.probe(hostname, pingOptions);
    
    // 解析ping结果
    const isAlive = pingResult.alive;
    const pingTime = pingResult.time === 'unknown' ? null : parseFloat(pingResult.time);
    
    // 判断状态
    if (!isAlive) {
      return {
        status: MONITOR_STATUS.DOWN,
        message: '目标不可达',
        ping: null
      };
    } else if (maxResponseTime && pingTime && pingTime > maxResponseTime) {
      return {
        status: MONITOR_STATUS.DOWN,
        message: `响应时间(${pingTime}ms)超过阈值(${maxResponseTime}ms)`,
        ping: pingTime
      };
    }
    
    return {
      status: MONITOR_STATUS.UP,
      message: pingTime ? `Ping正常: ${pingTime}ms` : 'Ping正常',
      ping: pingTime
    };
  } catch (error) {
    return {
      status: MONITOR_STATUS.DOWN,
      message: `Ping执行错误: ${error instanceof Error ? error.message : String(error)}`,
      ping: null
    };
  }
}

/**
 * 执行ICMP Ping检查（包含重试逻辑）
 * @param config ICMP监控配置
 * @returns 检查结果
 */
export async function checkIcmp(config: MonitorIcmpConfig): Promise<MonitorCheckResult> {
  const { retries = 0, retryInterval = 60 } = config;
  
  // 如果没有设置重试次数，直接执行单次检查
  if (retries === 0) {
    return await checkIcmpSingle(config);
  }
  
  // 执行首次检查
  const result = await checkIcmpSingle(config);
  
  // 如果首次检查成功，直接返回
  if (result.status === MONITOR_STATUS.UP) {
    return result;
  }
  
  // 如果配置了重试次数且首次检查失败，进行重试
  if (retries > 0) {
    for (let i = 0; i < retries; i++) {
      // 等待重试间隔时间（秒）
      await new Promise(resolve => setTimeout(resolve, retryInterval * 1000));
      
      // 执行重试检查
      const retryResult = await checkIcmpSingle(config);
      
      if (retryResult.status === MONITOR_STATUS.UP) {
        return {
          ...retryResult,
          message: `重试成功 (${i + 1}/${retries}): ${retryResult.message}`
        };
      }
    }
    
    return {
      ...result,
      message: `重试${retries}次后仍然失败: ${result.message}`
    };
  }
  
  return result;
} 