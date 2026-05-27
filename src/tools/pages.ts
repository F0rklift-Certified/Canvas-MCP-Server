import { CanvasClient } from "../canvas-client.js";

export const pageTools = [
  {
    name: "get_pages",
    description:
      "List all pages (wiki pages, lecture notes) in a course. Pages often contain instructor-written content and summaries.",
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
    name: "get_page_content",
    description:
      "Get the full text content of a specific Canvas page. Use this to read instructor notes, lecture summaries, or reading guides.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID",
        },
        page_url: {
          type: "string",
          description: "The page URL slug (from get_pages or get_module_items)",
        },
      },
      required: ["course_id", "page_url"],
    },
  },
];

export async function handlePageTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_pages") {
    const courseId = args.course_id as number;
    const pages = await client.getPages(courseId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            pages.map((p) => ({
              title: p.title,
              url: p.url,
              updated_at: p.updated_at,
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  if (toolName === "get_page_content") {
    const courseId = args.course_id as number;
    const pageUrl = args.page_url as string;
    const page = await client.getPage(courseId, pageUrl);

    // Strip HTML tags for clean readable text
    const text = page.body
      ?.replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim() ?? "";

    return {
      content: [
        {
          type: "text" as const,
          text: `# ${page.title}\nLast updated: ${page.updated_at}\n\n${text}`,
        },
      ],
    };
  }
}
