import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 获取状态页列表
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const statusPages = await prisma.statusPage.findMany({
      where: {
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(statusPages);
  } catch (error) {
    console.error('获取状态页列表失败:', error);
    return NextResponse.json({ error: '获取状态页列表失败' }, { status: 500 });
  }
}

// 创建状态页
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, title, isPublic = true } = body;

    if (!name || !slug || !title) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查slug是否已存在
    const existingStatusPage = await prisma.statusPage.findUnique({
      where: { slug }
    });

    if (existingStatusPage) {
      return NextResponse.json({ error: 'URL标识符已存在' }, { status: 400 });
    }

    const statusPage = await prisma.statusPage.create({
      data: {
        name,
        slug,
        title,
        isPublic,
        createdById: session.user.id
      }
    });

    return NextResponse.json(statusPage, { status: 201 });
  } catch (error) {
    console.error('创建状态页失败:', error);
    return NextResponse.json({ error: '创建状态页失败' }, { status: 500 });
  }
} 