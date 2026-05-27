import { CanvasClient } from "../canvas-client.js";

export const fileTools = [
  {
    name: "get_files",
    description:
      "List all files uploaded to a course (lecture slides, readings, etc.). Returns file IDs, names, and types. Use get_file_content to read a file's text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "get_file_content",
    description:
      "Download and extract text content from a Canvas file. Supports PDF and plain text files. Use this to read lecture notes, readings, or slides as study context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_id: {
          type: "number",
          description: "The file ID (from get_files or get_module_items)",
        },
      },
      required: ["file_id"],
    },
  },
];

export async function handleFileTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_files") {
    const courseId = args.course_id as number;
    const files = await client.getFiles(courseId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            files.map((f) => ({
              id: f.id,
              name: f.display_name,
              type: f.content_type,
              size_kb: Math.round(f.size / 1024),
              updated_at: f.updated_at,
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  if (toolName === "get_file_content") {
    const fileId = args.file_id as number;
    const file = await client.getFile(fileId);
    const text = await client.extractFileText(file);

    // Truncate very large files to avoid overwhelming context
    const MAX_CHARS = 50_000;
    const truncated = text.length > MAX_CHARS;
    const content = truncated ? text.slice(0, MAX_CHARS) + "\n\n[... content truncated, file too large ...]" : text;

    return {
      content: [
        {
          type: "text" as const,
          text: `# ${file.display_name}\nType: ${file.content_type}\n\n${content}`,
        },
      ],
    };
  }
}
