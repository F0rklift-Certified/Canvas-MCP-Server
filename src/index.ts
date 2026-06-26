import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";

import { CanvasClient } from "./canvas-client.js";
import { handleCourseTools } from "./tools/courses.js";
import { handleModuleTools } from "./tools/modules.js";
import { handleFileTools } from "./tools/files.js";
import { handleAssignmentTools } from "./tools/assignments.js";
import { handlePageTools } from "./tools/pages.js";

dotenv.config({ quiet: true });

const CANVAS_TOKEN = process.env.CANVAS_TOKEN;
const CANVAS_DOMAIN = process.env.CANVAS_DOMAIN;

if (!CANVAS_TOKEN || !CANVAS_DOMAIN) {
  console.error("Missing CANVAS_TOKEN or CANVAS_DOMAIN in environment.");
  console.error("Copy .env.example to .env and fill in your credentials.");
  process.exit(1);
}

const client = new CanvasClient(CANVAS_DOMAIN, CANVAS_TOKEN);
const server = new McpServer({
  name: "canvas-study",
  version: "0.1.0",
});

// --- Courses ---
server.tool("get_courses", "List all active enrolled courses", {}, async () => {
  return (await handleCourseTools("get_courses", {}, client))!;
});

// --- Modules ---
server.tool(
  "get_modules",
  "Get the list of modules (topics/weeks) for a course",
  { course_id: z.number().describe("The Canvas course ID") },
  async (args) => {
    return (await handleModuleTools("get_modules", args, client))!;
  }
);

server.tool(
  "get_module_items",
  "Get all items within a specific module — files, pages, assignments, quizzes",
  {
    course_id: z.number().describe("The Canvas course ID"),
    module_id: z.number().describe("The module ID"),
  },
  async (args) => {
    return (await handleModuleTools("get_module_items", args, client))!;
  }
);

// --- Files ---
server.tool(
  "get_files",
  "List all files uploaded to a course (lecture slides, readings, etc.)",
  { course_id: z.number().describe("The Canvas course ID") },
  async (args) => {
    return (await handleFileTools("get_files", args, client))!;
  }
);

server.tool(
  "get_file_content",
  "Download and extract text content from a Canvas file (PDF or text)",
  { file_id: z.number().describe("The file ID from get_files") },
  async (args) => {
    return (await handleFileTools("get_file_content", args, client))!;
  }
);

// --- Assignments ---
server.tool(
  "get_assignments",
  "List all assignments for a course with due dates and point values",
  { course_id: z.number().describe("The Canvas course ID") },
  async (args) => {
    return (await handleAssignmentTools("get_assignments", args, client))!;
  }
);

server.tool(
  "get_assignment_description",
  "Get the full description/instructions and grading rubric for a single assignment",
  {
    course_id: z.number().describe("The Canvas course ID"),
    assignment_id: z.number().describe("The assignment ID from get_assignments"),
  },
  async (args) => {
    return (await handleAssignmentTools("get_assignment_description", args, client))!;
  }
);

// --- Pages ---
server.tool(
  "get_pages",
  "List all pages (wiki pages, lecture notes) in a course",
  { course_id: z.number().describe("The Canvas course ID") },
  async (args) => {
    return (await handlePageTools("get_pages", args, client))!;
  }
);

server.tool(
  "get_page_content",
  "Get the full text content of a specific Canvas page",
  {
    course_id: z.number().describe("The Canvas course ID"),
    page_url: z.string().describe("The page URL slug from get_pages"),
  },
  async (args) => {
    return (await handlePageTools("get_page_content", args, client))!;
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Canvas Study MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
