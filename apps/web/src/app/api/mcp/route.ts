import { NextRequest } from 'next/server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createAgelumMcpServer } from '@/lib/mcp';
import { getAgelumConfig } from '@/lib/config';

// Global storage for transports (dev mode HMR support)
const globalForMcp = globalThis as unknown as {
  mcpTransports: Map<string, SSEServerTransport>;
};
if (!globalForMcp.mcpTransports) {
  globalForMcp.mcpTransports = new Map();
}
const transports = globalForMcp.mcpTransports;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Mock Node.js ServerResponse for the SDK
  // We pipe the writes to our Web Stream writer
  const mockRes = {
    writeHead: (status: number, headers?: any) => {
      // We set headers on the Response object, so we can ignore this
      // or use it to close the stream if status is error
      if (status >= 400) {
        console.error('MCP Server Error:', status);
      }
    },
    write: (chunk: string) => {
      writer.write(encoder.encode(chunk));
      return true;
    },
    end: () => {
      writer.close();
    },
    // Dummy event emitters
    on: () => {},
    once: () => {},
    emit: () => {},
    removeListener: () => {},
  } as unknown as any;

  try {
    const config = getAgelumConfig();
    const globalRoot = config?.rootGitDirectory;

    const server = createAgelumMcpServer(globalRoot);
    
    // Create the transport with our mock response
    // The SDK will write the initial SSE handshake to it
    const transport = new SSEServerTransport('/api/mcp', mockRes);
    
    await server.connect(transport);
    
    // Store session
    transports.set(transport.sessionId, transport);

    // Clean up on client disconnect
    req.signal.addEventListener('abort', () => {
      console.log(`MCP session closed: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
      server.close();
      // Ensure writer is closed
      try { writer.close(); } catch {}
    });

    console.log(`MCP session started: ${transport.sessionId}`);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  
  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return new Response('Session not found', { status: 404 });
  }

  try {
    const message = await req.json();
    
    // Inject message directly into the transport's listener
    // This bypasses the need to mock req/res for handlePostMessage
    if (transport.onmessage) {
      transport.onmessage(message);
    }
    
    return new Response('Accepted', { status: 200 });
  } catch (error) {
    console.error('Error handling MCP message:', error);
    return new Response('Bad Request', { status: 400 });
  }
}
