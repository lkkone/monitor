import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/auth-helpers';
import { getServerSession } from 'next-auth';
import { buildAuthOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户是否已登录
    const authError = await validateAuth();
    if (authError) return authError;

    // 获取用户信息
    const authOptions = await buildAuthOptions();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权的请求' },
        { status: 401 }
      );
    }

    // 获取监控ID参数
    const { id } = await params;
    const monitorId = id;

    // 验证用户是否有权限访问该监控项
    const monitor = await prisma.monitor.findUnique({
      where: {
        id: monitorId,
        // 如果是管理员，可以访问所有监控项
        ...(session.user.isAdmin ? {} : { createdById: session.user.id })
      }
    });

    if (!monitor) {
      return NextResponse.json(
        { error: '无权访问此监控项' },
        { status: 403 }
      );
    }

    // 一次性获取90天的历史记录，然后分别计算90天和30天的在线率
    const { uptime90d, availability30d } = await calculateUptimeBoth(monitorId);

    return NextResponse.json({
      uptime90d,
      availability30d
    });
  } catch (error) {
    console.error('计算在线率失败:', error);
    return NextResponse.json(
      { error: '计算在线率失败' },
      { status: 500 }
    );
  }
}

// 一次性计算90天和30天的在线率，避免重复查询数据库
async function calculateUptimeBoth(monitorId: string): Promise<{ uptime90d: string; availability30d: string }> {
  const now = new Date();
  const startDate90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // 获取监控项信息以获取间隔时间
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { interval: true }
  });
  
  // 一次性获取90天的历史记录（只选择计算在线率需要的字段）
  const history = await prisma.monitorStatus.findMany({
    where: {
      monitorId: monitorId,
      timestamp: {
        gte: startDate90d
      }
    },
    orderBy: {
      timestamp: 'asc'
    },
    select: {
      status: true,
      timestamp: true
    }
  });

  if (history.length === 0) {
    return { uptime90d: "100.0000%", availability30d: "100.0000%" };
  }

  if (history.length === 1) {
    // 只有一条记录时，根据状态返回
    const singleResult = history[0].status === 1 ? "100.0000%" : "0.0000%";
    return { uptime90d: singleResult, availability30d: singleResult };
  }

  // 计算90天在线率
  const uptime90d = calculateUptimeFromHistory(history, now, monitor?.interval || 60);
  
  // 计算30天在线率（从90天数据中过滤出30天的数据）
  const startDate30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const history30d = history.filter(record => new Date(record.timestamp) >= startDate30d);
  const availability30d = history30d.length > 0 
    ? calculateUptimeFromHistory(history30d, now, monitor?.interval || 60)
    : "100.0000%";

  return { uptime90d, availability30d };
}

// 从历史记录计算在线率的辅助函数
function calculateUptimeFromHistory(history: Array<{ status: number; timestamp: Date }>, now: Date, interval: number): string {
  if (history.length === 0) {
    return "100.0000%";
  }

  if (history.length === 1) {
    return history[0].status === 1 ? "100.0000%" : "0.0000%";
  }

  let totalTime = 0;
  let uptimeTime = 0;

  // 计算基于时间间隔的可用性
  for (let i = 0; i < history.length - 1; i++) {
    const currentRecord = history[i];
    const nextRecord = history[i + 1];
    
    const currentTime = new Date(currentRecord.timestamp).getTime();
    const nextTime = new Date(nextRecord.timestamp).getTime();
    const timeInterval = nextTime - currentTime;
    
    totalTime += timeInterval;
    
    // 如果当前状态是UP，则认为这段时间是在线的
    if (currentRecord.status === 1) {
      uptimeTime += timeInterval;
    }
  }

  // 处理最后一条记录（假设其状态持续到现在或检测间隔时间）
  const lastRecord = history[history.length - 1];
  const lastTime = new Date(lastRecord.timestamp).getTime();
  
  // 假设最后一条记录的状态持续一个检测间隔的时间
  const assumedInterval = interval * 1000;
  // 限制最后一条记录的时间权重，避免因长时间未检查而影响计算准确性
  const lastInterval = Math.min(now.getTime() - lastTime, assumedInterval * 2);
  
  totalTime += lastInterval;
  if (lastRecord.status === 1) {
    uptimeTime += lastInterval;
  }

  if (totalTime === 0) {
    return "100.0000%";
  }

  const uptimePercentage = (uptimeTime / totalTime) * 100;
  return uptimePercentage.toFixed(4) + "%";
}
