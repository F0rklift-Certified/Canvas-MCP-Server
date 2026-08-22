import axios, { AxiosInstance } from "axios";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const officeParser = require("officeparser") as {
  parseOffice: (input: Buffer, config?: Record<string, unknown>) => Promise<{ toText: () => string } | string>;
};

export interface Course {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
}

export interface Module {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items_url: string;
}

export interface ModuleItem {
  id: number;
  title: string;
  type: string; // "File" | "Page" | "Discussion" | "Assignment" | "Quiz" | "ExternalUrl" | "ExternalTool" | "SubHeader"
  content_id?: number;
  html_url?: string;
  url?: string; // API url for the item
  page_url?: string; // for Pages
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  content_type: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  ratings?: { description: string; long_description?: string; points: number }[];
}

export interface Assignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  course_id: number;
  rubric?: RubricCriterion[];
}

export interface Page {
  page_id: string;
  url: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export class CanvasClient {
  private http: AxiosInstance;

  constructor(domain: string, token: string) {
    this.http = axios.create({
      baseURL: `${domain.replace(/\/$/, "")}/api/v1`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  // Fetch all pages of a paginated Canvas endpoint
  private async fetchAllPages<T>(url: string, params: Record<string, unknown> = {}): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await this.http.get<T[]>(nextUrl, {
        params: nextUrl === url ? { per_page: 100, ...params } : undefined,
      });
      results.push(...response.data);

      // Canvas uses Link headers for pagination
      const linkHeader = response.headers["link"] as string | undefined;
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
    }

    return results;
  }

  async getCourses(): Promise<Course[]> {
    return this.fetchAllPages<Course>("/courses", {
      enrollment_state: "active",
      include: ["term"],
    });
  }

  async getModules(courseId: number): Promise<Module[]> {
    return this.fetchAllPages<Module>(`/courses/${courseId}/modules`);
  }

  async getModuleItems(courseId: number, moduleId: number): Promise<ModuleItem[]> {
    return this.fetchAllPages<ModuleItem>(
      `/courses/${courseId}/modules/${moduleId}/items`
    );
  }

  async getFiles(courseId: number): Promise<CanvasFile[]> {
    return this.fetchAllPages<CanvasFile>(`/courses/${courseId}/files`, {
      sort: "updated_at",
      order: "desc",
    });
  }

  async getFile(fileId: number, courseId?: number): Promise<CanvasFile> {
    // Prefer course-scoped endpoint — many institutions block the global /files/:id for students
    if (courseId) {
      try {
        const res = await this.http.get<CanvasFile>(
          `/courses/${courseId}/files/${fileId}`
        );
        return res.data;
      } catch {
        // Fall through to global endpoint
      }
    }

    const res = await this.http.get<CanvasFile>(`/files/${fileId}`);
    return res.data;
  }

  /**
   * Attempt to resolve a file's download URL by finding it in course module items.
   * Useful when both /files/:id and /courses/:id/files/:id return 403.
   */
  async getFileUrlFromModules(
    courseId: number,
    fileId: number
  ): Promise<CanvasFile | null> {
    const modules = await this.getModules(courseId);

    for (const mod of modules) {
      const items = await this.getModuleItems(courseId, mod.id);
      for (const item of items) {
        if (item.type === "File" && item.content_id === fileId && item.url) {
          // item.url is the Canvas API URL for the file — fetch it to get the full file object
          try {
            const res = await this.http.get<CanvasFile>(item.url);
            return res.data;
          } catch {
            // continue scanning
          }
        }
      }
    }

    return null;
  }

  async getAssignments(courseId: number): Promise<Assignment[]> {
    return this.fetchAllPages<Assignment>(`/courses/${courseId}/assignments`, {
      order_by: "due_at",
    });
  }

  async getAssignment(courseId: number, assignmentId: number): Promise<Assignment> {
    const res = await this.http.get<Assignment>(
      `/courses/${courseId}/assignments/${assignmentId}`
    );
    return res.data;
  }

  async getPage(courseId: number, pageUrl: string): Promise<Page> {
    const res = await this.http.get<Page>(
      `/courses/${courseId}/pages/${pageUrl}`
    );
    return res.data;
  }

  async getPages(courseId: number): Promise<Page[]> {
    return this.fetchAllPages<Page>(`/courses/${courseId}/pages`);
  }

  // Download a Canvas file and extract its text content
  async extractFileText(file: CanvasFile): Promise<string> {
    // Download using the authenticated client — many institutions (e.g. those with SSO)
    // require the bearer token even for the file download URL.
    let buffer: Buffer;

    try {
      // Use the file's download URL with auth headers
      const response = await this.http.get<ArrayBuffer>(file.url, {
        responseType: "arraybuffer",
        maxRedirects: 5,
      });
      buffer = Buffer.from(response.data);
    } catch {
      // Fallback: try without auth (for institutions where the URL is truly pre-authenticated)
      const response = await axios.get<ArrayBuffer>(file.url, {
        responseType: "arraybuffer",
        maxRedirects: 5,
      });
      buffer = Buffer.from(response.data);
    }

    // Verify we didn't get an HTML login page
    const head = buffer.toString("utf-8", 0, 100);
    if (head.includes("<!DOCTYPE") || head.includes("<html")) {
      throw new Error(
        `File download returned an HTML page (likely SSO redirect). File "${file.display_name}" cannot be downloaded with the current token.`
      );
    }

    // Canvas sometimes returns "content-type" (hyphenated) instead of "content_type"
    const contentType =
      file.content_type ||
      (file as unknown as Record<string, string>)["content-type"] ||
      this.inferContentType(file.filename || file.display_name);

    if (contentType === "application/pdf") {
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (
      contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      contentType === "application/vnd.ms-powerpoint"
    ) {
      const ext = file.filename?.split(".").pop()?.toLowerCase() || "pptx";
      const result = await officeParser.parseOffice(buffer, { outputErrorToConsole: false, fileType: ext });
      const text = typeof result === "string" ? result : result?.toText?.() || "";
      return text || `[File "${file.display_name}" appears to be an empty or image-only presentation.]`;
    }

    if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      const ext = file.filename?.split(".").pop()?.toLowerCase() || "docx";
      const result = await officeParser.parseOffice(buffer, { outputErrorToConsole: false, fileType: ext });
      const text = typeof result === "string" ? result : result?.toText?.() || "";
      return text || `[File "${file.display_name}" appears to be an empty document.]`;
    }

    if (
      contentType === "text/plain" ||
      contentType === "text/html" ||
      contentType?.startsWith("text/")
    ) {
      return buffer.toString("utf-8");
    }

    // For unsupported types return a note
    return `[File "${file.display_name}" is of type ${contentType || "unknown"} — text extraction not supported yet. File size: ${Math.round(file.size / 1024)}KB]`;
  }

  private inferContentType(filename: string): string | undefined {
    const ext = filename.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
      html: "text/html",
      htm: "text/html",
      csv: "text/csv",
      md: "text/plain",
    };
    return ext ? map[ext] : undefined;
  }
}
