/**
 * 紧凑ID生成工具
 * 生成比UUID更短但仍然唯一的ID
 */

// Base36字符集：0-9, a-z
const BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * 生成紧凑的时间戳+随机数ID
 * 格式：时间戳(base36) + 随机数(base36)
 * 长度：约12-15字符，比UUID的36字符短很多
 */
export function generateCompactId(): string {
  // 时间戳转base36 (约6-7字符)
  const timestamp = Date.now().toString(36);
  
  // 4位随机数转base36 (约3字符)
  const random1 = Math.floor(Math.random() * 1296).toString(36); // 36^2 = 1296
  
  // 额外4位随机数保证唯一性 (约3字符)  
  const random2 = Math.floor(Math.random() * 1296).toString(36);
  
  return timestamp + random1 + random2;
}

/**
 * 生成超短ID（适用于高频记录）
 * 格式：时间戳(base36后6位) + 2位随机数
 * 长度：8字符
 * 注意：适合短期使用，长期可能有冲突风险
 */
export function generateUltraCompactId(): string {
  // 取时间戳的后6位base36字符
  const timestamp = Date.now().toString(36).slice(-6);
  
  // 2位随机数
  const random = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  
  return timestamp + random;
}

/**
 * 验证ID格式类型
 */
export function getIdType(id: string): 'uuid' | 'cuid' | 'compact' | 'ultra-compact' | 'unknown' {
  // UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return 'uuid';
  }
  
  // CUID格式：cxxxxxxxxxxxxxxxxxxxxxxxxx
  if (/^c[0-9a-z]{24}$/.test(id)) {
    return 'cuid';
  }
  
  // 超紧凑ID格式：6-8位字母数字
  if (/^[0-9a-z]{6,8}$/.test(id)) {
    return 'ultra-compact';
  }
  
  // 紧凑ID格式：9-15位字母数字
  if (/^[0-9a-z]{9,15}$/.test(id)) {
    return 'compact';
  }
  
  return 'unknown';
}

/**
 * 验证ID格式是否为紧凑ID
 */
export function isCompactId(id: string): boolean {
  return getIdType(id) === 'compact';
}

/**
 * 检查是否为旧格式ID（UUID或CUID）
 */
export function isLegacyId(id: string): boolean {
  const type = getIdType(id);
  return type === 'uuid' || type === 'cuid';
}

/**
 * 检查是否为超紧凑ID
 */
export function isUltraCompactId(id: string): boolean {
  return getIdType(id) === 'ultra-compact';
}

/**
 * 从紧凑ID中提取时间戳（如果可能）
 */
export function extractTimestampFromCompactId(id: string): number | null {
  if (!isCompactId(id) || id.length < 8) {
    return null;
  }
  
  try {
    // 尝试解析前面的时间戳部分
    const timestampPart = id.slice(0, -6); // 去掉后6位随机数部分
    return parseInt(timestampPart, 36);
  } catch {
    return null;
  }
}
