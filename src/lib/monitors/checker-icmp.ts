import { MonitorIcmpConfig, MonitorCheckResult, MONITOR_STATUS } from './types';
import ping from 'ping';

/**
 * 执行ICMP Ping检查
 * @param config ICMP监控配置
 * @returns 检查结果
 */
export async function checkIcmp(config: MonitorIcmpConfig): Promise<MonitorCheckResult> {
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