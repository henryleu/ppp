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
import { sprintManager } from "../utils/sprint.js";
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
        },
        {
          name: "ppp_sprint_create",
          description: "Create a new sprint",
          inputSchema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Sprint description"
              }
            },
            required: ["description"]
          }
        },
        {
          name: "ppp_sprint_list",
          description: "List all sprints with their status",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        },
        {
          name: "ppp_sprint_activate",
          description: "Activate a sprint (deactivates any currently active sprint)",
          inputSchema: {
            type: "object",
            properties: {
              sprintNo: {
                type: "string",
                description: "Sprint number to activate (e.g., '01', '02')"
              }
            },
            required: ["sprintNo"]
          }
        },
        {
          name: "ppp_sprint_complete",
          description: "Complete an active sprint",
          inputSchema: {
            type: "object",
            properties: {
              sprintNo: {
                type: "string",
                description: "Sprint number to complete (e.g., '01', '02')"
              }
            },
            required: ["sprintNo"]
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
                text: `Successfully initialized ppp project "${projectName}"\n\nFiles created:\n- .ppp/settings.json\n- .ppp/README.md\n- .ppp/TRACK.md\n- .ppp/SPEC.md\n- .ppp/IMPL.md`
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

        case "ppp_sprint_create":
          const sprintDescription = args?.description;
          if (!sprintDescription) {
            throw new McpError(ErrorCode.InvalidParams, "Description is required");
          }
          
          const sprint = await sprintManager.createSprint({ description: sprintDescription });
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully created ${sprint.name}\n\nDetails:\n- Description: ${sprint.description}\n- Status: ${sprint.state}\n- Start Date: ${new Date(sprint.startDate).toLocaleDateString()}\n- File: .ppp/${sprint.id}.md`
              }
            ]
          };

        case "ppp_sprint_list":
          const sprints = await sprintManager.getAllSprints();
          
          if (sprints.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No sprints found. Create one with ppp_sprint_create."
                }
              ]
            };
          }
          
          const activeSprint = await sprintManager.getActiveSprint();
          let sprintList = "All Sprints:\n\n";
          
          for (const sprint of sprints) {
            sprintList += `- ${sprint.name} (${sprint.state})\n`;
            sprintList += `  Start: ${new Date(sprint.startDate).toLocaleDateString()}\n`;
            sprintList += `  Issues: ${sprint.issueCount}, Velocity: ${sprint.velocity}\n\n`;
          }
          
          if (activeSprint) {
            sprintList += `\nActive Sprint: ${activeSprint.name}\n`;
            sprintList += `Description: ${activeSprint.description}\n`;
            sprintList += `Issues: ${activeSprint.issues.length}`;
          } else {
            sprintList += "\nNo active sprint.";
          }
          
          return {
            content: [
              {
                type: "text",
                text: sprintList
              }
            ]
          };

        case "ppp_sprint_activate":
          const sprintNoActivate = args?.sprintNo;
          if (!sprintNoActivate) {
            throw new McpError(ErrorCode.InvalidParams, "Sprint number is required");
          }
          
          const activateSuccess = await sprintManager.activateSprint(sprintNoActivate);
          
          if (!activateSuccess) {
            throw new McpError(ErrorCode.InvalidParams, `Sprint ${sprintNoActivate} not found`);
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully activated Sprint ${sprintNoActivate}\n\n- All previously active sprints have been completed\n- All issues in this sprint are now "In Progress"\n- Release.md has been updated`
              }
            ]
          };

        case "ppp_sprint_complete":
          const sprintNoComplete = args?.sprintNo;
          if (!sprintNoComplete) {
            throw new McpError(ErrorCode.InvalidParams, "Sprint number is required");
          }
          
          const completeSuccess = await sprintManager.completeSprint(sprintNoComplete);
          
          if (!completeSuccess) {
            throw new McpError(ErrorCode.InvalidParams, `Sprint ${sprintNoComplete} not found`);
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully completed Sprint ${sprintNoComplete}\n\n- Sprint velocity calculated based on completed issues\n- Release.md has been updated\n- Sprint is now available for archival`
              }
            ]
          };

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
                text: "Please review the current ppp project status. Use the ppp_status tool to check the project structure, then read the key files like settings.json, SPEC.md, and TRACK.md to provide a comprehensive overview."
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