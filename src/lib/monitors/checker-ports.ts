import net from 'net';
import { MonitorPortConfig, MonitorCheckResult, MONITOR_STATUS, ERROR_MESSAGES } from './types';

/**
 * 检查TCP端口是否开放
 * @param config 端口监控配置
 * @returns 检查结果
 */
export async function checkPort(config: MonitorPortConfig): Promise<MonitorCheckResult> {
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