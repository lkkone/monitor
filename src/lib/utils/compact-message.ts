/**
 * 紧凑消息生成工具
 * 大幅减少正常状态下的message字段存储空间
 */

export interface CompactMessageOptions {
  /** 预留选项，当前策略是正常状态始终为null */
  reserved?: boolean;
}

/**
 * 为监控结果生成紧凑消息
 * 
 * 极简策略：
 * 1. 正常状态(UP)：完全不存储message（null），status字段已足够表示成功
 * 2. 错误状态(DOWN)：保留完整错误信息用于调试
 * 3. ping字段已存储响应时间，message中不重复存储时间信息
 */
export function generateCompactMessage(
  status: number,
  originalMessage: string,
  ping?: number
): string | null {
  // 状态定义
  const MONITOR_STATUS = {
    DOWN: 0,
    UP: 1,
    PENDING: 2
  };
  
  // 正常状态：完全不存储message，status=1已经表示成功
  if (status === MONITOR_STATUS.UP) {
    return null;
  }
  
  // 错误状态：保留完整错误信息，这很重要用于调试
  if (status === MONITOR_STATUS.DOWN) {
    return originalMessage;
  }
  
  // 等待状态：简短表示
  if (status === MONITOR_STATUS.PENDING) {
    return '等待中';
  }
  
  // 其他情况保持原样
  return originalMessage;
}

/**
 * 生成UI显示消息（兼容新旧数据格式）
 * 
 * 兼容性处理：
 * - 新数据：正常状态message为null，根据状态和类型生成显示文本
 * - 旧数据：正常状态有完整message，直接显示（保持向后兼容）
 * - 错误状态：始终显示详细信息
 */
export function generateDisplayMessage(
  status: number,
  storedMessage: string | null,
  ping?: number,
  monitorType?: string
): string {
  const MONITOR_STATUS = {
    DOWN: 0,
    UP: 1,
    PENDING: 2
  };
  
  // 如果有存储的message，优先使用（向后兼容旧数据）
  if (storedMessage) {
    return storedMessage;
  }
  
  // 新数据格式：正常状态message为null，需要生成显示文本
  if (status === MONITOR_STATUS.UP) {
    switch (monitorType) {
      case 'icmp':
      case 'http':
        return ping ? `响应正常 ${ping}ms` : '响应正常';
      case 'keyword':
        return '关键词检测通过';
      case 'port':
        return '端口连接正常';
      case 'mysql':
      case 'redis':
        return '数据库连接正常';
      case 'https-cert':
        return '证书有效';
      case 'push':
        return '推送正常';
      default:
        return '监控正常';
    }
  }
  
  // 错误或等待状态但没有消息
  if (status === MONITOR_STATUS.DOWN) {
    return '监控异常';
  }
  
  if (status === MONITOR_STATUS.PENDING) {
    return '等待中';
  }
  
  return '状态未知';
}

/**
 * 计算消息压缩比率
 */
export function calculateCompressionRatio(
  originalMessage: string,
  compactMessage: string | null
): number {
  const originalSize = originalMessage.length;
  const compactSize = compactMessage?.length || 0;
  
  if (originalSize === 0) return 0;
  
  return ((originalSize - compactSize) / originalSize) * 100;
}
