import { MonitorDatabaseConfig, MonitorCheckResult, MONITOR_STATUS, ERROR_MESSAGES } from './types';
import { createConnection as createMysqlConnection } from 'mysql2/promise';
import { createClient } from 'redis';

// 数据库监控检查（单次执行，不包含重试逻辑）
async function checkDatabaseSingle(type: string, config: MonitorDatabaseConfig): Promise<MonitorCheckResult> {
  // 兼容性处理：确保配置存在且至少包含必要字段
  if (!config || typeof config !== 'object') {
    return {
      status: MONITOR_STATUS.DOWN,
      message: '配置无效: 缺少必要的配置信息',
      ping: null
    };
  }

  // 验证主机名和端口是否存在
  if (!config.hostname) {
    return {
      status: MONITOR_STATUS.DOWN,
      message: '配置无效: 缺少主机名',
      ping: null
    };
  }

  if (config.port === undefined || config.port === null) {
    return {
      status: MONITOR_STATUS.DOWN,
      message: '配置无效: 缺少端口号',
      ping: null
    };
  }

  switch (type) {
    case 'mysql':
      return await checkMysql(config);
    case 'redis':
      return await checkRedis(config);
    default:
      return {
        status: MONITOR_STATUS.DOWN,
        message: `不支持的数据库类型: ${type}`,
        ping: null
      };
  }
}

// 数据库监控检查（包含重试逻辑）
export async function checkDatabase(type: string, config: MonitorDatabaseConfig): Promise<MonitorCheckResult> {
  const { retries = 0, retryInterval = 60 } = config;
  
  // 执行首次检查
  const result = await checkDatabaseSingle(type, config);
  
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
      const retryResult = await checkDatabaseSingle(type, config);
      
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

// MySQL监控检查
async function checkMysql(config: MonitorDatabaseConfig): Promise<MonitorCheckResult> {
  const { hostname, port, username, password, database, query } = config;
  const startTime = Date.now();
  
  // 验证端口号的有效性
  let portNumber: number;
  try {
    portNumber = typeof port === 'string' ? parseInt(port) : port;
    if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
      return {
        status: MONITOR_STATUS.DOWN,
        message: `配置无效: 端口号 ${port} 不是有效的端口值`,
        ping: null
      };
    }
  } catch {
    // 端口解析出错
    return {
      status: MONITOR_STATUS.DOWN,
      message: `配置无效: 端口格式错误 - ${port}`,
      ping: null
    };
  }
  
  let connection;
  
  try {
    // 创建MySQL连接
    connection = await createMysqlConnection({
      host: hostname,
      port: portNumber,
      user: username || undefined,
      password: password || undefined,
      database: database || 'mysql', // 默认使用mysql数据库
      connectTimeout: 10000 // 10秒连接超时
    });
    
    // 如果有指定查询，则执行查询
    if (query && query.trim()) {
      await connection.execute(query);
    } else {
      // 默认执行简单查询
      await connection.execute('SELECT 1');
    }
    
    const responseTime = Date.now() - startTime;
    return {
      status: MONITOR_STATUS.UP,
      message: '数据库连接正常' + (query && query.trim() ? ', 查询成功' : ''),
      ping: responseTime
    };
  } catch (error) {
    return {
      status: MONITOR_STATUS.DOWN,
      message: `${ERROR_MESSAGES.DATABASE_ERROR}: ${(error as Error).message}`,
      ping: Date.now() - startTime
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('关闭MySQL连接失败:', error);
      }
    }
  }
}

// Redis监控检查
async function checkRedis(config: MonitorDatabaseConfig): Promise<MonitorCheckResult> {
  const { hostname, port, password, query } = config;
  const startTime = Date.now();
  
  // 验证端口号的有效性
  let portNumber: number;
  try {
    portNumber = typeof port === 'string' ? parseInt(port) : port;
    if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
      return {
        status: MONITOR_STATUS.DOWN,
        message: `配置无效: 端口号 ${port} 不是有效的端口值`,
        ping: null
      };
    }
  } catch {
    // 端口解析出错
    return {
      status: MONITOR_STATUS.DOWN,
      message: `配置无效: 端口格式错误 - ${port}`,
      ping: null
    };
  }
  
  let client;
  
  try {
    // 创建Redis客户端
    client = createClient({
      url: `redis://${password ? `:${password}@` : ''}${hostname}:${portNumber}`,
      socket: {
        connectTimeout: 10000, // 10秒连接超时
      }
    });
    
    // 连接Redis
    await client.connect();
    
    // 如果有指定查询，则执行查询
    if (query && query.trim()) {
      try {
        await client.sendCommand(query.split(' '));
      } catch (cmdError) {
        return {
          status: MONITOR_STATUS.DOWN,
          message: `Redis命令执行失败: ${(cmdError as Error).message}`,
          ping: Date.now() - startTime
        };
      }
    } else {
      // 默认执行PING
      await client.ping();
    }
    
    const responseTime = Date.now() - startTime;
    return {
      status: MONITOR_STATUS.UP,
      message: 'Redis连接正常' + (query && query.trim() ? ', 命令执行成功' : ''),
      ping: responseTime
    };
  } catch (error) {
    return {
      status: MONITOR_STATUS.DOWN,
      message: `${ERROR_MESSAGES.DATABASE_ERROR}: ${(error as Error).message}`,
      ping: Date.now() - startTime
    };
  } finally {
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error('关闭Redis连接失败:', error);
      }
    }
  }
} 