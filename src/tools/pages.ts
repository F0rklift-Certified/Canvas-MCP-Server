import { CanvasClient } from "../canvas-client.js";
import { AxiosError } from "axios";

export const pageTools = [
  {
    name: "get_pages",
    description:
      "List all pages (wiki pages, lecture notes) in a course. Pages often contain instructor-written content and summaries. If direct page listing is unavailable (some institutions disable it), this will fall back to discovering pages through course modules.",
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

/**
 * Fallback: discover pages by scanning all module items for type "Page".
 * This works even when the /courses/:id/pages endpoint returns 404.
 */
async function discoverPagesViaModules(
  courseId: number,
  client: CanvasClient
): Promise<{ title: string; url: string; source: string }[]> {
  const modules = await client.getModules(courseId);
  const pages: { title: string; url: string; source: string }[] = [];

  for (const mod of modules) {
    const items = await client.getModuleItems(courseId, mod.id);
    for (const item of items) {
      if (item.type === "Page" && item.page_url) {
        pages.push({
          title: item.title,
          url: item.page_url,
          source: `module: ${mod.name}`,
        });
      }
    }
  }

  return pages;
}

export async function handlePageTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_pages") {
    const courseId = args.course_id as number;

    try {
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
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr?.response?.status;

      // 404 or 403 — the pages endpoint is blocked, fall back to module scanning
      if (status === 404 || status === 403 || status === 401) {
        const pages = await discoverPagesViaModules(courseId, client);

        if (pages.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `⚠️ Direct page listing returned ${status}. Scanned all modules but found no linked pages. Pages in this course may not be accessible with your current permissions.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text:
                `⚠️ Direct page listing returned ${status}. Found ${pages.length} page(s) via module scan:\n\n` +
                JSON.stringify(pages, null, 2) +
                `\n\nNote: Only pages linked in modules are visible. Use get_page_content with the url slug to read them.`,
            },
          ],
        };
      }

      // Unknown error — rethrow
      throw err;
    }
  }

  if (toolName === "get_page_content") {
    const courseId = args.course_id as number;
    const pageUrl = args.page_url as string;

    try {
      const page = await client.getPage(courseId, pageUrl);

      // Strip HTML tags for clean readable text
      const text =
        page.body
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
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr?.response?.status;

      if (status === 404 || status === 403 || status === 401) {
        return {
          content: [
            {
              type: "text" as const,
              text: `⚠️ Cannot access page "${pageUrl}" (HTTP ${status}). This page may require additional permissions or may not exist. Try discovering available pages through get_modules → get_module_items instead.`,
            },
          ],
        };
      }

      throw err;
    }
  }
}
