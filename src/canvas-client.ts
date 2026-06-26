import axios, { AxiosInstance } from "axios";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const officeParser = require("officeparser") as {
  parseOfficeAsync: (input: Buffer, config?: Record<string, unknown>) => Promise<string>;
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

  async getFile(fileId: number): Promise<CanvasFile> {
    const res = await this.http.get<CanvasFile>(`/files/${fileId}`);
    return res.data;
  }

  async getAssignments(courseId: number): Promise<Assignment[]> {
    return this.fetchAllPages<Assignment>(`/courses/${courseId}/assignments`, {
      order_by: "due_at",
      include: ["description"],
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
    const response = await axios.get<ArrayBuffer>(file.url, {
      responseType: "arraybuffer",
      // Canvas file URLs are pre-authenticated, no token needed
    });

    const buffer = Buffer.from(response.data);
    const contentType = file.content_type;

    if (contentType === "application/pdf") {
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (
      contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      contentType === "application/vnd.ms-powerpoint"
    ) {
      const text = await officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false });
      return text || `[File "${file.display_name}" appears to be an empty or image-only presentation.]`;
    }

    if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      const text = await officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false });
      return text || `[File "${file.display_name}" appears to be an empty document.]`;
    }

    if (
      contentType === "text/plain" ||
      contentType === "text/html" ||
      contentType.startsWith("text/")
    ) {
      return buffer.toString("utf-8");
    }

    // For unsupported types (docx, etc.) return a note
    return `[File "${file.display_name}" is of type ${contentType} — text extraction not supported yet. File size: ${Math.round(file.size / 1024)}KB]`;
  }
}
