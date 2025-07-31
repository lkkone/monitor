import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 获取状态页的监控项列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const statusPage = await prisma.statusPage.findFirst({
      where: {
        id,
        createdById: session.user.id
      },
      include: {
        monitors: {
          include: {
            monitor: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!statusPage) {
      return NextResponse.json({ error: '状态页不存在' }, { status: 404 });
    }

    return NextResponse.json(statusPage.monitors);
  } catch (error) {
    console.error('获取状态页监控项失败:', error);
    return NextResponse.json({ error: '获取状态页监控项失败' }, { status: 500 });
  }
}

// 添加监控项到状态页
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { monitorIds, displayNames, monitorId, displayName } = body;

    // 支持单个监控项和批量添加
    const monitorIdList = Array.isArray(monitorIds) ? monitorIds : (monitorId ? [monitorId] : []);
    const displayNameMap = displayNames || (displayName && monitorId ? { [monitorId]: displayName } : {});

    if (monitorIdList.length === 0) {
      return NextResponse.json({ error: '缺少监控项ID' }, { status: 400 });
    }

    // 检查状态页是否存在且属于当前用户
    const statusPage = await prisma.statusPage.findFirst({
      where: {
        id,
        createdById: session.user.id
      }
    });

    if (!statusPage) {
      return NextResponse.json({ error: '状态页不存在' }, { status: 404 });
    }

    // 检查所有监控项是否存在
    const monitors = await prisma.monitor.findMany({
      where: {
        id: { in: monitorIdList }
      }
    });

    if (monitors.length !== monitorIdList.length) {
      return NextResponse.json({ error: '部分监控项不存在' }, { status: 404 });
    }

    // 检查哪些监控项已经添加到状态页
    const existingMonitors = await prisma.statusPageMonitor.findMany({
      where: {
        statusPageId: id,
        monitorId: { in: monitorIdList }
      }
    });

    const existingMonitorIds = existingMonitors.map(em => em.monitorId);
    const newMonitorIds = monitorIdList.filter(id => !existingMonitorIds.includes(id));

    if (newMonitorIds.length === 0) {
      return NextResponse.json({ error: '所有监控项已添加到状态页' }, { status: 400 });
    }

    // 获取当前最大排序值
    const maxOrder = await prisma.statusPageMonitor.aggregate({
      where: { statusPageId: id },
      _max: { order: true }
    });

    let currentOrder = (maxOrder._max.order || 0) + 1;

    // 批量创建状态页监控项
    const statusPageMonitors = await Promise.all(
      newMonitorIds.map(async (monitorId) => {
        return await prisma.statusPageMonitor.create({
          data: {
            statusPageId: id,
            monitorId,
            displayName: displayNameMap[monitorId] || null,
            order: currentOrder++
          },
          include: {
            monitor: true
          }
        });
      })
    );

    return NextResponse.json(statusPageMonitors, { status: 201 });
  } catch (error) {
    console.error('添加监控项到状态页失败:', error);
    return NextResponse.json({ error: '添加监控项到状态页失败' }, { status: 500 });
  }
} 