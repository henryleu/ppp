import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { initCommand } from "../commands/init.js";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export async function startMCPServer() {
  const server = new Server(
    {
      name: "ppp-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "ppp_init",
          description: "Initialize ppp in the current directory",
          inputSchema: {
            type: "object",
            properties: {
              projectName: {
                type: "string",
                description: "Name of the project",
                default: "my-project"
              },
              description: {
                type: "string", 
                description: "Project description",
                default: "A new ppp project"
              }
            },
            required: []
          }
        },
        {
          name: "ppp_status",
          description: "Check ppp project status and list .ppp files",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "ppp_init":
          // Simulate the init command with provided arguments
          const projectName = args?.projectName || "my-project";
          const description = args?.description || "A new ppp project";
          
          // Call the existing init command logic
          await initCommand();
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully initialized ppp project "${projectName}"\n\nFiles created:\n- .ppp/config.json\n- .ppp/README.md\n- .ppp/TRACK.md\n- .ppp/SPEC.md\n- .ppp/IMPL.md`
              }
            ]
          };

        case "ppp_status":
          try {
            const pppDir = ".ppp";
            const files = await readdir(pppDir);
            const fileList = files.map(file => `- ${file}`).join("\n");
            
            return {
              content: [
                {
                  type: "text",
                  text: `ppp project status:\n\n.ppp directory contents:\n${fileList}`
                }
              ]
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "No ppp project found. Run `ppp init` first."
                }
              ]
            };
          }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const pppDir = ".ppp";
      const files = await readdir(pppDir);
      
      const resources = files.map(file => ({
        uri: `ppp:///${file}`,
        name: file,
        description: `ppp project file: ${file}`,
        mimeType: file.endsWith('.json') ? 'application/json' : 'text/markdown'
      }));

      return { resources };
    } catch (error) {
      return { resources: [] };
    }
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    
    if (!uri.startsWith("ppp:///")) {
      throw new McpError(ErrorCode.InvalidRequest, "Invalid resource URI");
    }
    
    const filename = uri.replace("ppp:///", "");
    const filepath = join(".ppp", filename);
    
    try {
      const content = await readFile(filepath, "utf-8");
      return {
        contents: [
          {
            uri,
            mimeType: filename.endsWith('.json') ? 'application/json' : 'text/markdown',
            text: content
          }
        ]
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Could not read resource: ${filename}`);
    }
  });

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "project_init",
          description: "Initialize a new ppp project with guided setup",
          arguments: [
            {
              name: "projectName",
              description: "Name of the project",
              required: false
            },
            {
              name: "description", 
              description: "Project description",
              required: false
            }
          ]
        },
        {
          name: "project_review",
          description: "Review current ppp project status and files",
          arguments: []
        }
      ]
    };
  });

  // Get prompt content
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "project_init":
        const projectName = args?.projectName || "my-project";
        const description = args?.description || "A new ppp project";
        
        return {
          description: "Initialize a new ppp project",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please initialize a new ppp project called "${projectName}" with description "${description}". Use the ppp_init tool to create the project structure.`
              }
            }
          ]
        };

      case "project_review":
        return {
          description: "Review current ppp project",
          messages: [
            {
              role: "user", 
              content: {
                type: "text",
                text: "Please review the current ppp project status. Use the ppp_status tool to check the project structure, then read the key files like config.json, SPEC.md, and TRACK.md to provide a comprehensive overview."
              }
            }
          ]
        };

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("ppp MCP Server started successfully");
}