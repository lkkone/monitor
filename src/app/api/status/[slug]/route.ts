import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 获取公开状态页数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const statusPage = await prisma.statusPage.findUnique({
      where: {
        slug,
        isPublic: true
      },
      include: {
        monitors: {
          include: {
            monitor: {
              select: {
                id: true,
                name: true,
                type: true,
                active: true,
                lastStatus: true,
                lastCheckAt: true,
                description: true
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!statusPage) {
      return NextResponse.json({ error: '状态页不存在或未公开' }, { status: 404 });
    }

    // 格式化监控项数据
    const monitors = statusPage.monitors.map(spm => ({
      id: spm.monitor.id,
      name: spm.displayName || spm.monitor.name,
      type: spm.monitor.type,
      status: spm.monitor.lastStatus,
      active: spm.monitor.active,
      lastCheckAt: spm.monitor.lastCheckAt,
      description: spm.monitor.description
    }));

    // 计算状态统计
    const totalMonitors = monitors.length;
    const normalCount = monitors.filter(m => m.active && m.status === 1).length;
    const errorCount = monitors.filter(m => m.active && m.status === 0).length;
    const pausedCount = monitors.filter(m => !m.active).length;
    const unknownCount = totalMonitors - normalCount - errorCount - pausedCount;

    const statusData = {
      id: statusPage.id,
      name: statusPage.name,
      title: statusPage.title,
      slug: statusPage.slug,
      monitors,
      statistics: {
        total: totalMonitors,
        normal: normalCount,
        error: errorCount,
        paused: pausedCount,
        unknown: unknownCount
      },
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(statusData);
  } catch (error) {
    console.error('获取状态页数据失败:', error);
    return NextResponse.json({ error: '获取状态页数据失败' }, { status: 500 });
  }
} 