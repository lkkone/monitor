import net from 'net';
import { MonitorPortConfig, MonitorCheckResult, MONITOR_STATUS, ERROR_MESSAGES } from './types';

/**
 * 检查TCP端口是否开放（单次执行，不包含重试逻辑）
 * @param config 端口监控配置
 * @returns 检查结果
 */
async function checkPortSingle(config: MonitorPortConfig): Promise<MonitorCheckResult> {
  const startTime = Date.now();
  const { hostname, port } = config;
  const portNumber = typeof port === 'string' ? parseInt(port) : port;

  return new Promise((resolve) => {
    try {
      const socket = new net.Socket();
      let resolved = false;

      // 设置超时
      socket.setTimeout(10000);

      socket.on('connect', () => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({
          status: MONITOR_STATUS.UP,
          message: `端口开放`,
          ping: Date.now() - startTime
        });
      });

      socket.on('timeout', () => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({
          status: MONITOR_STATUS.DOWN,
          message: ERROR_MESSAGES.TIMEOUT,
          ping: Date.now() - startTime
        });
      });

      socket.on('error', (error: NodeJS.ErrnoException) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();

        let message = ERROR_MESSAGES.UNKNOWN_ERROR;
        if (error.code === 'ECONNREFUSED') {
          message = ERROR_MESSAGES.CONNECTION_REFUSED;
        } else if (error.code === 'ETIMEDOUT') {
          message = ERROR_MESSAGES.TIMEOUT;
        } else if (error.code === 'ENOTFOUND') {
          message = ERROR_MESSAGES.HOST_NOT_FOUND;
        } else {
          message = `${ERROR_MESSAGES.NETWORK_ERROR}: ${error.message}`;
        }

        resolve({
          status: MONITOR_STATUS.DOWN,
          message,
          ping: Date.now() - startTime
        });
      });

      // 开始连接
      socket.connect(portNumber, hostname);
    } catch (error) {
      resolve({
        status: MONITOR_STATUS.DOWN,
        message: `${ERROR_MESSAGES.UNKNOWN_ERROR}: ${error instanceof Error ? error.message : String(error)}`,
        ping: null
      });
    }
  });
}

/**
 * 检查TCP端口是否开放（包含重试逻辑）
 * @param config 端口监控配置
 * @returns 检查结果
 */
export async function checkPort(config: MonitorPortConfig): Promise<MonitorCheckResult> {
  const { retries = 0, retryInterval = 60 } = config;
  
  // 如果没有设置重试次数，直接执行单次检查
  if (retries === 0) {
    return await checkPortSingle(config);
  }
  
  // 执行首次检查
  const result = await checkPortSingle(config);
  
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
      const retryResult = await checkPortSingle(config);
      
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