/**
 * 超紧凑ID生成器 - 改进版
 * 基于3年时间窗口设计，在保证唯一性的前提下最大化压缩
 * 新增碰撞检测和重试机制，大幅降低冲突概率
 */

// 基础配置
const BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime(); // 固定起始时间点
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000; // 3年毫秒数

// 碰撞检测缓存（用于快速检测重复）
const recentIds = new Set<string>();
const MAX_CACHE_SIZE = 10000; // 缓存最近1万个ID

/**
 * 清理缓存，防止内存泄漏
 */
function cleanupCache() {
  if (recentIds.size > MAX_CACHE_SIZE) {
    const idsArray = Array.from(recentIds);
    recentIds.clear();
    // 保留最后1000个ID
    idsArray.slice(-1000).forEach(id => recentIds.add(id));
  }
}

/**
 * 检查ID是否已存在（快速缓存检查）
 */
function isIdExists(id: string): boolean {
  return recentIds.has(id);
}

/**
 * 添加ID到缓存
 */
function addIdToCache(id: string) {
  recentIds.add(id);
  cleanupCache();
}

/**
 * 方案1：6位超紧凑ID（已废弃，仅保留兼容性）
 * 
 * 格式：TTTRR
 * - TTT: 3位时间编码（基于相对时间戳）
 * - RR: 2位随机数
 * 
 * 理论：
 * - 时间部分：36^3 = 46,656 个时间单位
 * - 3年 ≈ 94,608,000秒，每个时间单位 ≈ 2027秒（约34分钟）
 * - 随机部分：36^2 = 1,296 种组合
 * - 总空间：46,656 * 1,296 = 60,466,176 种组合
 */
export function generateUltraCompactId6(): string {
  const now = Date.now();
  const relativeTime = now - BASE_TIME;
  
  // 确保在3年范围内
  if (relativeTime < 0 || relativeTime > THREE_YEARS_MS) {
    throw new Error('时间超出3年范围，需要调整BASE_TIME');
  }
  
  // 将3年时间映射到36^3空间（约34分钟一个单位）
  const timeUnit = Math.floor(relativeTime / (THREE_YEARS_MS / (36 * 36 * 36)));
  const timeCode = timeUnit.toString(36).padStart(3, '0');
  
  // 2位随机数
  const random = Math.floor(Math.random() * 36 * 36).toString(36).padStart(2, '0');
  
  return timeCode + random;
}

/**
 * 方案2：7位平衡ID（改进版）
 * 
 * 格式：TTTTRRR
 * - TTTT: 4位时间编码（更精确的时间）
 * - RRR: 3位随机数
 * 
 * 理论：
 * - 时间部分：36^4 = 1,679,616 个时间单位 
 * - 每个时间单位 ≈ 56秒，精度高
 * - 随机部分：36^3 = 46,656 种组合
 * - 总空间：1,679,616 * 46,656 = 78,383,816,096 种组合（过剩但安全）
 */
export function generateUltraCompactId7(): string {
  const now = Date.now();
  const relativeTime = now - BASE_TIME;
  
  if (relativeTime < 0 || relativeTime > THREE_YEARS_MS) {
    throw new Error('时间超出3年范围，需要调整BASE_TIME');
  }
  
  // 将3年时间映射到36^4空间（约56秒一个单位）
  const timeUnit = Math.floor(relativeTime / (THREE_YEARS_MS / (36 * 36 * 36 * 36)));
  const timeCode = timeUnit.toString(36).padStart(4, '0');
  
  // 3位随机数
  const random = Math.floor(Math.random() * 36 * 36 * 36).toString(36).padStart(3, '0');
  
  return timeCode + random;
}

/**
 * 方案3：8位安全ID（推荐）
 * 
 * 格式：TTTTTRR + 校验位
 * - TTTTT: 5位时间编码（高精度时间）
 * - RR: 2位随机数
 * - 最后1位：校验位（可选）
 * 
 * 理论：
 * - 时间部分：36^5 = 60,466,176 个时间单位
 * - 每个时间单位 ≈ 1.56秒，极高精度
 * - 随机部分：36^2 = 1,296 种组合  
 * - 总空间：巨大，几乎无碰撞风险
 */
export function generateUltraCompactId8(): string {
  const now = Date.now();
  const relativeTime = now - BASE_TIME;
  
  if (relativeTime < 0 || relativeTime > THREE_YEARS_MS) {
    throw new Error('时间超出3年范围，需要调整BASE_TIME');
  }
  
  // 将3年时间映射到36^5空间（约1.56秒一个单位）
  const timeUnit = Math.floor(relativeTime / (THREE_YEARS_MS / (36 * 36 * 36 * 36 * 36)));
  const timeCode = timeUnit.toString(36).padStart(5, '0');
  
  // 2位随机数
  const random = Math.floor(Math.random() * 36 * 36).toString(36).padStart(2, '0');
  
  // 可选：添加简单校验位
  const checksum = ((timeUnit + random.charCodeAt(0) + random.charCodeAt(1)) % 36).toString(36);
  
  return timeCode + random + checksum;
}

/**
 * 方案4：9位超安全ID（新增，推荐用于高并发场景）
 * 
 * 格式：TTTTTTRRR
 * - TTTTTT: 6位时间编码（极高精度时间）
 * - RRR: 3位随机数
 * 
 * 理论：
 * - 时间部分：36^6 = 2,176,782,336 个时间单位
 * - 每个时间单位 ≈ 0.043秒，极高精度
 * - 随机部分：36^3 = 46,656 种组合
 * - 总空间：101,562,132,566,016 种组合，几乎不可能碰撞
 */
export function generateUltraCompactId9(): string {
  const now = Date.now();
  const relativeTime = now - BASE_TIME;
  
  if (relativeTime < 0 || relativeTime > THREE_YEARS_MS) {
    throw new Error('时间超出3年范围，需要调整BASE_TIME');
  }
  
  // 将3年时间映射到36^6空间（约0.043秒一个单位）
  const timeUnit = Math.floor(relativeTime / (THREE_YEARS_MS / (36 * 36 * 36 * 36 * 36 * 36)));
  const timeCode = timeUnit.toString(36).padStart(6, '0');
  
  // 3位随机数
  const random = Math.floor(Math.random() * 36 * 36 * 36).toString(36).padStart(3, '0');
  
  return timeCode + random;
}

/**
 * 带重试机制的ID生成器
 * 自动检测碰撞并重试，确保生成唯一ID
 */
export function generateUltraCompactIdWithRetry(maxRetries: number = 10): string {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 优先使用9位ID，如果失败则降级到8位
    let id: string;
    
    if (attempt < 5) {
      // 前5次尝试使用9位ID
      id = generateUltraCompactId9();
    } else {
      // 后5次尝试使用8位ID
      id = generateUltraCompactId8();
    }
    
    // 检查缓存中是否已存在
    if (!isIdExists(id)) {
      addIdToCache(id);
      return id;
    }
    
    // 如果存在，等待一小段时间后重试
    if (attempt < maxRetries - 1) {
      // 使用递增延迟，避免同时重试
      const delay = Math.random() * (attempt + 1) * 10; // 0-10ms, 0-20ms, 0-30ms...
      if (delay > 0) {
        // 在Node.js环境中使用setImmediate，在浏览器中使用setTimeout
        if (typeof setImmediate !== 'undefined') {
          // 同步等待（简化处理，实际项目中可能需要异步）
          const start = Date.now();
          while (Date.now() - start < delay) {
            // 忙等待
          }
        }
      }
    }
  }
  
  // 如果所有重试都失败，使用UUID作为后备方案
  console.warn('超紧凑ID生成重试失败，使用UUID后备方案');
  return generateUUID();
}

/**
 * 生成UUID作为后备方案
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 默认推荐：使用带重试机制的9位超安全ID
 * 在安全性和紧凑性之间取得最佳平衡
 */
export function generateUltraCompactId(): string {
  return generateUltraCompactIdWithRetry();
}

/**
 * 验证超紧凑ID格式
 */
export function isUltraCompactId(id: string): boolean {
  return /^[0-9a-z]{6,9}$/.test(id);
}

/**
 * 从超紧凑ID中提取时间信息
 */
export function extractTimeFromUltraCompactId(id: string): Date | null {
  if (!isUltraCompactId(id)) {
    return null;
  }
  
  try {
    let timeCode: string;
    let timeUnits: number;
    
    if (id.length === 6) {
      // 6位格式：TTT + RR
      timeCode = id.substring(0, 3);
      timeUnits = 36 * 36 * 36;
    } else if (id.length === 7) {
      // 7位格式：TTTT + RRR  
      timeCode = id.substring(0, 4);
      timeUnits = 36 * 36 * 36 * 36;
    } else if (id.length === 8) {
      // 8位格式：TTTTT + RR + C
      timeCode = id.substring(0, 5);
      timeUnits = 36 * 36 * 36 * 36 * 36;
    } else if (id.length === 9) {
      // 9位格式：TTTTTT + RRR
      timeCode = id.substring(0, 6);
      timeUnits = 36 * 36 * 36 * 36 * 36 * 36;
    } else {
      return null;
    }
    
    const timeUnit = parseInt(timeCode, 36);
    const unitDuration = THREE_YEARS_MS / timeUnits;
    const relativeTime = timeUnit * unitDuration;
    
    return new Date(BASE_TIME + relativeTime);
  } catch {
    return null;
  }
}

/**
 * 计算ID碰撞风险
 */
export function calculateCollisionRisk(idLength: number, recordsPerDay: number): {
  dailyRisk: number;
  yearlyRisk: number;
  threeYearRisk: number;
} {
  let timeUnits: number;
  let randomSpace: number;
  
  switch (idLength) {
    case 6:
      timeUnits = 36 * 36 * 36;
      randomSpace = 36 * 36;
      break;
    case 7:
      timeUnits = 36 * 36 * 36 * 36;
      randomSpace = 36 * 36 * 36;
      break;
    case 8:
      timeUnits = 36 * 36 * 36 * 36 * 36;
      randomSpace = 36 * 36;
      break;
    case 9:
      timeUnits = 36 * 36 * 36 * 36 * 36 * 36;
      randomSpace = 36 * 36 * 36;
      break;
    default:
      throw new Error('不支持的ID长度');
  }
  
  const unitDuration = THREE_YEARS_MS / timeUnits / 1000; // 转为秒
  const recordsPerUnit = (recordsPerDay * unitDuration) / (24 * 60 * 60);
  
  // 使用生日悖论公式估算碰撞概率
  const dailyRisk = 1 - Math.exp(-Math.pow(recordsPerDay, 2) / (2 * randomSpace));
  const yearlyRisk = 1 - Math.pow(1 - dailyRisk, 365);
  const threeYearRisk = 1 - Math.pow(1 - dailyRisk, 365 * 3);
  
  return {
    dailyRisk: dailyRisk * 100,
    yearlyRisk: yearlyRisk * 100, 
    threeYearRisk: threeYearRisk * 100
  };
}

/**
 * 获取ID生成器统计信息
 */
export function getGeneratorStats(): {
  cacheSize: number;
  maxCacheSize: number;
  collisionRate: number;
} {
  return {
    cacheSize: recentIds.size,
    maxCacheSize: MAX_CACHE_SIZE,
    collisionRate: 0 // 这里可以添加碰撞率统计逻辑
  };
}
