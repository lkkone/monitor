import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import axios from 'axios';
import crypto from 'crypto';
import { formatDateTime } from '@/lib/monitors/utils';
import { validateAuth } from '@/lib/auth-helpers';

// 定义不同类型通知的配置接口
interface EmailConfig {
  email: string;
  smtpServer: string;
  smtpPort: string | number;
  username?: string;
  password?: string;
}

interface WebhookConfig {
  url: string;
}

interface WechatConfig {
  pushUrl: string;
  titleTemplate?: string;
  contentTemplate?: string;
}

interface DingTalkConfig {
  webhookUrl: string;
  secret?: string;
}

interface WorkWechatConfig {
  webhookUrl: string;
}

// 测试通知接口
export async function POST(request: NextRequest) {
  try {
    // 验证用户是否已登录
    const authError = await validateAuth();
    if (authError) return authError;
    
    const body = await request.json();
    
    if (!body || !body.type || !body.config) {
      return NextResponse.json(
        { success: false, error: '缺少必要的字段' },
        { status: 400 }
      );
    }
    
    // 根据不同类型的通知渠道执行测试
    const { type, name, config } = body;
    
    switch (type) {
      case '邮件':
        return await testEmailNotification(name, config as EmailConfig);
      case 'Webhook':
        return await testWebhookNotification(name, config as WebhookConfig);
      case '微信推送':
        return await testWechatNotification(name, config as WechatConfig);
      case '钉钉推送':
        return await testDingTalkNotification(name, config as DingTalkConfig);
      case '企业微信推送':
        return await testWorkWechatNotification(name, config as WorkWechatConfig);
      default:
        return NextResponse.json(
          { success: false, error: '不支持的通知类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('测试通知失败:', error);
    return NextResponse.json(
      { success: false, error: '测试通知失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}

// 测试邮件通知
async function testEmailNotification(name: string, config: EmailConfig) {
  const { email, smtpServer, smtpPort, username, password } = config;
  
  if (!email || !smtpServer || !smtpPort) {
    return NextResponse.json(
      { success: false, error: '邮件配置不完整，请检查收件人地址、SMTP服务器和端口' },
      { status: 400 }
    );
  }
  
  try {
    // 创建一个Nodemailer传输器
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465, // true表示465端口，false表示其他端口
      auth: {
        user: username || email, // 如果未提供用户名，使用邮箱地址
        pass: password
      }
    });
    
    // 发送测试邮件
    const info = await transporter.sendMail({
      from: username || email,
      to: email,
      subject: `Monitor - 测试通知 - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #6366F1; border-radius: 10px;">
          <h2 style="color: #6366F1;">🔔 Monitor通知测试</h2>
          <p>您好，这是来自 <strong>Monitor</strong> 系统的测试通知邮件。</p>
          <p>通知渠道名称: <strong>${name}</strong></p>
          <p>如果您收到此邮件，表示您的邮件通知设置已配置成功！</p>
          <hr style="border-top: 1px solid #EEE; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
      `
    });
    
    console.log('邮件测试成功:', info.messageId);
    return NextResponse.json({ success: true, message: `测试邮件已成功发送至 ${email}` });
  } catch (error) {
    console.error('发送测试邮件失败:', error);
    return NextResponse.json(
      { success: false, error: '发送测试邮件失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}

// 测试Webhook通知
async function testWebhookNotification(name: string, config: WebhookConfig) {
  const { url } = config;
  
  if (!url) {
    return NextResponse.json(
      { success: false, error: 'Webhook URL不能为空' },
      { status: 400 }
    );
  }
  
  try {
    console.log(`开始测试Webhook通知: ${name}, URL: ${url}`);
    
    // 准备测试数据 - 使用与实际通知一致的格式
    const webhookData = {
      event: 'status_change',
      timestamp: new Date().toISOString(),
      monitor: {
        name: '测试监控项',
        type: 'http',
        status: '正常',  // 中文状态描述
        status_code: 1,  // 状态码: 1=正常
        time: formatDateTime(),
        message: '这是一条来自Monitor的测试通知'
      },
      // 添加失败信息结构，与实际通知保持一致
      failure_info: null
    };
    
    console.log(`Webhook测试数据: ${JSON.stringify(webhookData)}`);
    
    // 发送Webhook请求
    const response = await axios.post(url, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoolMonitor-Notification-Service'
      },
      timeout: 10000 // 10秒超时
    });
    
    console.log(`Webhook测试响应: 状态码=${response.status}, 数据=${JSON.stringify(response.data)}`);
    
    if (response.status >= 200 && response.status < 300) {
      return NextResponse.json({ success: true, message: `测试Webhook请求已成功发送，响应状态码: ${response.status}` });
    } else {
      return NextResponse.json(
        { success: false, error: `Webhook请求失败，响应状态码: ${response.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('发送Webhook通知失败:', error);
    let errorMessage = '发送Webhook请求失败';
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Webhook请求失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}`);
        errorMessage += `: 服务器返回状态码 ${error.response.status}`;
      } else if (error.request) {
        console.error(`Webhook请求失败，无响应: ${error.message}`);
        errorMessage += `: 请求发送成功但未收到响应，可能是网络问题或URL无效`;
      } else {
        console.error(`Webhook请求失败，请求配置错误: ${error.message}`);
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      console.error(`Webhook请求失败，其他错误: ${error.message}`);
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 测试钉钉推送通知
async function testDingTalkNotification(name: string, config: DingTalkConfig) {
  const { webhookUrl, secret } = config;
  const messageType = 'markdown'; // 固定使用markdown格式
  
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: '钉钉Webhook URL不能为空' },
      { status: 400 }
    );
  }
  
  try {
    console.log(`开始测试钉钉推送: ${name}, URL: ${webhookUrl}`);
    
    // 构建测试消息内容
    let content = '';
    const title = `Monitor - 测试通知 - ${name}`;
    
    // 使用Markdown消息格式
    content = `## 🔔 Monitor通知测试\n\n` +
      `- **通知渠道名称**: ${name}\n` +
      `- **测试时间**: ${formatDateTime()}\n\n` +
      `如果您收到此消息，表示您的钉钉推送设置已配置成功！`;
    
    // 构建钉钉消息体
    interface DingTalkMessageBody {
      msgtype: string;
      text?: {
        content: string;
      };
      markdown?: {
        title: string;
        text: string;
      };
      at: {
        atMobiles: string[];
        atUserIds: string[];
        isAtAll: boolean;
      };
    }
    
    const messageBody: DingTalkMessageBody = {
      msgtype: messageType,
      markdown: {
        title: title,
        text: content
      },
      at: {
        atMobiles: [],
        atUserIds: [],
        isAtAll: false
      }
    };
    
    // 如果配置了加签密钥，则生成签名
    let finalUrl = webhookUrl;
    if (secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
      const encodedSign = encodeURIComponent(sign);
      finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodedSign}`;
    }
    
    console.log(`钉钉推送测试数据: ${JSON.stringify(messageBody)}`);
    
    // 发送钉钉推送请求
    const response = await axios.post(finalUrl, messageBody, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoolMonitor-DingTalk-Notification'
      },
      timeout: 10000
    });
    
    console.log(`钉钉推送测试响应: 状态码=${response.status}, 数据=${JSON.stringify(response.data)}`);
    
    // 检查钉钉API返回的结果
    if (response.data && response.data.errcode !== undefined) {
      if (response.data.errcode === 0) {
        return NextResponse.json({ success: true, message: '测试钉钉推送已成功发送' });
      } else {
        return NextResponse.json(
          { success: false, error: `钉钉API返回错误: ${response.data.errmsg || '未知错误'}` },
          { status: 400 }
        );
      }
    } else if (response.status >= 200 && response.status < 300) {
      return NextResponse.json({ success: true, message: '测试钉钉推送已成功发送' });
    } else {
      return NextResponse.json(
        { success: false, error: `钉钉推送请求失败，响应状态码: ${response.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('发送钉钉推送通知失败:', error);
    let errorMessage = '发送钉钉推送请求失败';
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`钉钉推送请求失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}`);
        errorMessage += `: 服务器返回状态码 ${error.response.status}`;
        if (error.response.data && error.response.data.errmsg) {
          errorMessage += ` - ${error.response.data.errmsg}`;
        }
      } else if (error.request) {
        console.error(`钉钉推送请求失败，无响应: ${error.message}`);
        errorMessage += `: 请求发送成功但未收到响应，可能是网络问题或URL无效`;
      } else {
        console.error(`钉钉推送请求失败，请求配置错误: ${error.message}`);
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      console.error(`钉钉推送请求失败，其他错误: ${error.message}`);
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 测试微信推送通知
async function testWechatNotification(name: string, config: WechatConfig) {
  const { pushUrl } = config;
  
  if (!pushUrl) {
    return NextResponse.json(
      { success: false, error: '微信推送URL不能为空' },
      { status: 400 }
    );
  }
  
  try {
    // 准备测试数据
    const title = 'Monitor - 测试通知';
    const content = `## Monitor通知测试\n\n这是来自Monitor系统的测试通知。\n\n- **通知渠道**: ${name}\n- **测试时间**: ${formatDateTime()}\n\n如果您收到此通知，表示您的微信推送设置已配置成功！`;
    
    console.log(`开始测试微信推送: ${name}, URL: ${pushUrl}`);
    console.log(`微信推送测试数据: 标题=${title}, 内容=${content}`);
    
    // 发送推送请求
    const response = await axios.post(pushUrl, { 
      title, 
      content 
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });
    
    console.log(`微信推送测试响应: 状态码=${response.status}, 数据=${JSON.stringify(response.data)}`);
    
    if (response.status >= 200 && response.status < 300) {
      return NextResponse.json({ success: true, message: '测试微信推送已成功发送' });
    } else {
      return NextResponse.json(
        { success: false, error: `微信推送请求失败，响应状态码: ${response.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('发送微信推送通知失败:', error);
    let errorMessage = '发送微信推送请求失败';
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`微信推送请求失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}`);
        errorMessage += `: 服务器返回状态码 ${error.response.status}`;
      } else if (error.request) {
        console.error(`微信推送请求失败，无响应: ${error.message}`);
        errorMessage += `: 请求发送成功但未收到响应，可能是网络问题或URL无效`;
      } else {
        console.error(`微信推送请求失败，请求配置错误: ${error.message}`);
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      console.error(`微信推送请求失败，其他错误: ${error.message}`);
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// 测试企业微信推送通知
async function testWorkWechatNotification(name: string, config: WorkWechatConfig) {
  const { webhookUrl } = config;
  
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: '企业微信Webhook URL不能为空' },
      { status: 400 }
    );
  }
  
  try {
    console.log(`开始测试企业微信推送: ${name}, URL: ${webhookUrl}`);
    
    // 构建测试消息内容
    const content = `## 🔔 Monitor通知测试\n\n` +
      `- **通知渠道名称**: ${name}\n` +
      `- **测试时间**: ${formatDateTime()}\n\n` +
      `如果您收到此消息，表示您的企业微信推送设置已配置成功！`;
    
    // 构建企业微信消息体
    const messageBody = {
      msgtype: 'markdown',
      markdown: {
        content: content
      }
    };
    
    console.log(`企业微信推送测试数据: ${JSON.stringify(messageBody)}`);
    
    // 发送企业微信推送请求
    const response = await axios.post(webhookUrl, messageBody, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoolMonitor-WorkWechat-Notification'
      },
      timeout: 10000
    });
    
    console.log(`企业微信推送测试响应: 状态码=${response.status}, 数据=${JSON.stringify(response.data)}`);
    
    // 检查企业微信API返回的结果
    if (response.data && response.data.errcode !== undefined) {
      if (response.data.errcode === 0) {
        return NextResponse.json({ success: true, message: '测试企业微信推送已成功发送' });
      } else {
        return NextResponse.json(
          { success: false, error: `企业微信API返回错误: ${response.data.errmsg || '未知错误'}` },
          { status: 400 }
        );
      }
    } else if (response.status >= 200 && response.status < 300) {
      return NextResponse.json({ success: true, message: '测试企业微信推送已成功发送' });
    } else {
      return NextResponse.json(
        { success: false, error: `企业微信推送请求失败，响应状态码: ${response.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('发送企业微信推送通知失败:', error);
    let errorMessage = '发送企业微信推送请求失败';
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`企业微信推送请求失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}`);
        errorMessage += `: 服务器返回状态码 ${error.response.status}`;
        if (error.response.data && error.response.data.errmsg) {
          errorMessage += ` - ${error.response.data.errmsg}`;
        }
      } else if (error.request) {
        console.error(`企业微信推送请求失败，无响应: ${error.message}`);
        errorMessage += `: 请求发送成功但未收到响应，可能是网络问题或URL无效`;
      } else {
        console.error(`企业微信推送请求失败，请求配置错误: ${error.message}`);
        errorMessage += `: ${error.message}`;
      }
    } else if (error instanceof Error) {
      console.error(`企业微信推送请求失败，其他错误: ${error.message}`);
      errorMessage += `: ${error.message}`;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
} 