import { CanvasClient } from "../canvas-client.js";
import { AxiosError } from "axios";

export const fileTools = [
  {
    name: "get_files",
    description:
      "List all files uploaded to a course (lecture slides, readings, etc.). Returns file IDs, names, and types. Use get_file_content to read a file's text. If the files endpoint is blocked (403), this will attempt to discover files through module items instead.",
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

/**
 * Fallback: discover files by scanning all module items for type "File".
 * This works even when the /courses/:id/files endpoint returns 403.
 */
async function discoverFilesViaModules(
  courseId: number,
  client: CanvasClient
): Promise<{ title: string; content_id: number | undefined; source: string }[]> {
  const modules = await client.getModules(courseId);
  const files: { title: string; content_id: number | undefined; source: string }[] = [];

  for (const mod of modules) {
    const items = await client.getModuleItems(courseId, mod.id);
    for (const item of items) {
      if (item.type === "File" && item.content_id) {
        files.push({
          title: item.title,
          content_id: item.content_id,
          source: `module: ${mod.name}`,
        });
      }
    }
  }

  return files;
}

export async function handleFileTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_files") {
    const courseId = args.course_id as number;

    try {
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
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr?.response?.status;

      if (status === 403 || status === 401 || status === 404) {
        // Try discovering files through modules
        const files = await discoverFilesViaModules(courseId, client);

        if (files.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `⚠️ File listing returned HTTP ${status} — your institution restricts direct file access for students.\n\n` +
                  `Scanned all modules but found no linked files either. Files in this course are not accessible with your current permissions.\n\n` +
                  `Tip: Some file content may be embedded in pages or assignment descriptions instead.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text:
                `⚠️ File listing returned HTTP ${status} — direct file browsing is restricted. Found ${files.length} file(s) linked in modules:\n\n` +
                JSON.stringify(files, null, 2) +
                `\n\nUse get_file_content with the content_id as file_id to attempt reading these files.`,
            },
          ],
        };
      }

      throw err;
    }
  }

  if (toolName === "get_file_content") {
    const fileId = args.file_id as number;

    try {
      const file = await client.getFile(fileId);
      const text = await client.extractFileText(file);

      // Truncate very large files to avoid overwhelming context
      const MAX_CHARS = 50_000;
      const truncated = text.length > MAX_CHARS;
      const content = truncated
        ? text.slice(0, MAX_CHARS) + "\n\n[... content truncated, file too large ...]"
        : text;

      return {
        content: [
          {
            type: "text" as const,
            text: `# ${file.display_name}\nType: ${file.content_type}\n\n${content}`,
          },
        ],
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr?.response?.status;

      if (status === 403 || status === 401) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `⚠️ Cannot access file ${fileId} (HTTP ${status}). Your institution restricts file downloads for this course.\n\n` +
                `Tip: The content may be available through assignment descriptions or page content instead.`,
            },
          ],
        };
      }

      if (status === 404) {
        return {
          content: [
            {
              type: "text" as const,
              text: `⚠️ File ${fileId} not found (HTTP 404). It may have been removed or the ID may be incorrect.`,
            },
          ],
        };
      }

      throw err;
    }
  }
}
