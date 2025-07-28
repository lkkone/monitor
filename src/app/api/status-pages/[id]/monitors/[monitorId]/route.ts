import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 从状态页移除监控项
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; monitorId: string }> }
) {
  try {
    const { id, monitorId } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
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

    // 删除监控项关联
    await prisma.statusPageMonitor.delete({
      where: {
        statusPageId_monitorId: {
          statusPageId: id,
          monitorId
        }
      }
    });

    return NextResponse.json({ message: '监控项移除成功' });
  } catch (error) {
    console.error('移除监控项失败:', error);
    return NextResponse.json({ error: '移除监控项失败' }, { status: 500 });
  }
} 