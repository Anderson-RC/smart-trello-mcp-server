import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export class MockMcpServer {
  private tools = new Map<string, { schema: any; handler: any }>();

  tool(name: string, ...args: any[]) {
    let description: string | undefined;
    let schema: any;
    let handler: any;

    if (args.length === 3) {
      [description, schema, handler] = args;
    } else {
      [schema, handler] = args;
    }

    this.tools.set(name, { schema, handler });
    return this;
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  async callTool(name: string, params: any) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    // Simple schema validation
    if (tool.schema) {
        // If it's a Zod schema (which it usually is in this project)
        const result = Object.entries(tool.schema).reduce((acc, [key, schema]: [string, any]) => {
            // simplified validation mock
            return acc;
        }, {});
    }
    return tool.handler(params);
  }
}
