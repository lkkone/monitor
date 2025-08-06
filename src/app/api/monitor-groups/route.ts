import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 获取所有分组
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const groups = await prisma.monitorGroup.findMany({
      where: {
        createdById: session.user.id
      },
      include: {
        monitors: {
          select: {
            id: true,
            name: true,
            lastStatus: true,
            active: true
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('获取分组失败:', error);
    return NextResponse.json({ error: '获取分组失败' }, { status: 500 });
  }
}

// 创建新分组
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: '分组名称不能为空' }, { status: 400 });
    }

    // 检查分组名称是否已存在
    const existingGroup = await prisma.monitorGroup.findFirst({
      where: {
        name: name.trim(),
        createdById: session.user.id
      }
    });

    if (existingGroup) {
      return NextResponse.json({ error: '分组名称已存在' }, { status: 400 });
    }

    // 获取当前最大排序值
    const maxOrder = await prisma.monitorGroup.findFirst({
      where: { createdById: session.user.id },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    });

    const newGroup = await prisma.monitorGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        displayOrder: (maxOrder?.displayOrder || 0) + 1,
        createdById: session.user.id
      }
    });

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error('创建分组失败:', error);
    return NextResponse.json({ error: '创建分组失败' }, { status: 500 });
  }
} 