import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 获取单个分组
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const group = await prisma.monitorGroup.findFirst({
      where: {
        id: params.id,
        createdById: session.user.id
      },
      include: {
        monitors: {
          select: {
            id: true,
            name: true,
            lastStatus: true,
            active: true,
            type: true,
            lastCheckAt: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('获取分组失败:', error);
    return NextResponse.json({ error: '获取分组失败' }, { status: 500 });
  }
}

// 更新分组
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 检查分组是否存在且属于当前用户
    const existingGroup = await prisma.monitorGroup.findFirst({
      where: {
        id: params.id,
        createdById: session.user.id
      }
    });

    if (!existingGroup) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 });
    }

    // 检查新名称是否与其他分组冲突
    const nameConflict = await prisma.monitorGroup.findFirst({
      where: {
        name: name.trim(),
        createdById: session.user.id,
        id: { not: params.id }
      }
    });

    if (nameConflict) {
      return NextResponse.json({ error: '分组名称已存在' }, { status: 400 });
    }

    const updatedGroup = await prisma.monitorGroup.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('更新分组失败:', error);
    return NextResponse.json({ error: '更新分组失败' }, { status: 500 });
  }
}

// 删除分组
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 检查分组是否存在且属于当前用户
    const existingGroup = await prisma.monitorGroup.findFirst({
      where: {
        id: params.id,
        createdById: session.user.id
      },
      include: {
        monitors: true
      }
    });

    if (!existingGroup) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 });
    }

    // 如果分组中有监控项，先将它们移到未分组状态
    if (existingGroup.monitors.length > 0) {
      await prisma.monitor.updateMany({
        where: {
          groupId: params.id
        },
        data: {
          groupId: null
        }
      });
    }

    // 删除分组
    await prisma.monitorGroup.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: '分组删除成功' });
  } catch (error) {
    console.error('删除分组失败:', error);
    return NextResponse.json({ error: '删除分组失败' }, { status: 500 });
  }
} 