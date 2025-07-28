import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 获取单个状态页详情
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

    return NextResponse.json(statusPage);
  } catch (error) {
    console.error('获取状态页详情失败:', error);
    return NextResponse.json({ error: '获取状态页详情失败' }, { status: 500 });
  }
}

// 更新状态页
export async function PUT(
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
    const { name, slug, title, isPublic } = body;

    // 检查状态页是否存在且属于当前用户
    const existingStatusPage = await prisma.statusPage.findFirst({
      where: {
        id,
        createdById: session.user.id
      }
    });

    if (!existingStatusPage) {
      return NextResponse.json({ error: '状态页不存在' }, { status: 404 });
    }

    // 如果更新slug，检查是否与其他状态页冲突
    if (slug && slug !== existingStatusPage.slug) {
      const conflictStatusPage = await prisma.statusPage.findUnique({
        where: { slug }
      });

      if (conflictStatusPage) {
        return NextResponse.json({ error: 'URL标识符已存在' }, { status: 400 });
      }
    }

    const updatedStatusPage = await prisma.statusPage.update({
      where: { id },
      data: {
        name,
        slug,
        title,
        isPublic
      }
    });

    return NextResponse.json(updatedStatusPage);
  } catch (error) {
    console.error('更新状态页失败:', error);
    return NextResponse.json({ error: '更新状态页失败' }, { status: 500 });
  }
}

// 删除状态页
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 检查状态页是否存在且属于当前用户
    const existingStatusPage = await prisma.statusPage.findFirst({
      where: {
        id,
        createdById: session.user.id
      }
    });

    if (!existingStatusPage) {
      return NextResponse.json({ error: '状态页不存在' }, { status: 404 });
    }

    await prisma.statusPage.delete({
      where: { id }
    });

    return NextResponse.json({ message: '状态页删除成功' });
  } catch (error) {
    console.error('删除状态页失败:', error);
    return NextResponse.json({ error: '删除状态页失败' }, { status: 500 });
  }
} 