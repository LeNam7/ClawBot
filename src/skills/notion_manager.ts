// src/skills/notion_manager.ts
import { Client } from "@notionhq/client";
import { config } from "../config/env.js";

// Initialize Notion client (will be undefined if token is missing but won't crash on load)
let notion: Client;
if (config.notionApiKey) {
    notion = new Client({ auth: config.notionApiKey });
}

export const details = {
    name: "notion_manager",
    description: "Công cụ quản lý bộ nhớ ngoại vi: Lưu và Đọc nhiệm vụ (Tasks) từ Notion. Chỉ gọi hành động này khi người dùng muốn thêm việc vào bộ nhớ hoặc cần lục lại sách các task trong ngày.",
    parameters: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["add_task", "get_tasks"],
                description: "Hành động cần thực thi: 'add_task' (thêm việc), 'get_tasks' (đọc việc đang có)",
            },
            title: {
                type: "string",
                description: "Tên công việc (Bắt buộc nếu action='add_task')",
            },
            due_date: {
                type: "string",
                description: "Hạn chót hoặc lịch hẹn (ISO 8601 string, VD: 2026-04-13). Không bắt buộc.",
            },
        },
        required: ["action"],
    },
};

export async function execute(args: { action: string; title?: string; due_date?: string }, deps: any, ctx: any) {
    // SECURITY HOOK: Ngăn chặn người ngoài xài Tool của sếp
    if (config.adminUserId && ctx?.msg?.userId && ctx.msg.userId !== config.adminUserId) {
        return JSON.stringify({
            status: "error",
            message: "MẬT VỤ CLAWBOT: Cảnh báo bảo mật! Bạn không phải là Chỉ Huy, bạn không có quyền truy cập vào Dữ liệu gốc!",
        });
    }

    if (!config.notionApiKey || !config.notionDatabaseId) {
        return JSON.stringify({
            status: "error",
            message: "Missing NOTION_API_KEY or NOTION_DATABASE_ID in .env file. User must retrieve and add these tokens first.",
        });
    }

    if (!notion) {
        notion = new Client({ auth: config.notionApiKey });
    }

    const { action, title, due_date } = args;

    try {
        if (action === "add_task") {
            if (!title) return JSON.stringify({ status: "error", message: "title is required for add_task" });
            
            // Dò tìm Schema của bảng để xem có cột Date không
            const dbInfo = await (notion.databases as any).retrieve({ database_id: config.notionDatabaseId });
            const dbProps = dbInfo.properties || {};
            const datePropKey = Object.keys(dbProps).find(k => dbProps[k].type === "date");

            const properties: any = {
                "Name": { // Trụ cột mặc định của database Notion
                    title: [
                        {
                            text: {
                                content: title,
                            },
                        },
                    ],
                },
            };

            // Nếu user có nhập due_date và Notion DB có hỗ trợ cột Date
            if (due_date && datePropKey) {
                properties[datePropKey] = {
                    date: { start: due_date }
                };
            }

            const response = await notion.pages.create({
                parent: { database_id: config.notionDatabaseId },
                properties: properties,
            });
            
            const scheduleMsg = (due_date && datePropKey) ? ` (Đã hẹn ngày: ${due_date})` : (due_date ? ` (Thất bại khi hẹn ngày vì bảng Notion không có cột Date)` : ``);
            
            return JSON.stringify({
                status: "success",
                message: `Task '${title}' đã được ghim thành công vào Notion${scheduleMsg}. ID: ${response.id}`,
            });
        } 
        
        else if (action === "get_tasks") {
            const response = await (notion.databases as any).query({
                database_id: config.notionDatabaseId,
                page_size: 15, 
            });

            const tasks = response.results.map((page: any) => {
                let taskName = "Untitled";
                let dateInfo = "";
                // Rà soát tìm cột tên là 'Name' hoặc có định dạng title
                const titleKey = Object.keys(page.properties).find(k => page.properties[k].type === "title");
                if (titleKey && page.properties[titleKey].title[0]) {
                    taskName = page.properties[titleKey].title[0].plain_text;
                }
                
                // Rà soát cột Date để lấy ngày
                const dateKey = Object.keys(page.properties).find(k => page.properties[k].type === "date");
                if (dateKey && page.properties[dateKey].date?.start) {
                    dateInfo = ` (Date: ${page.properties[dateKey].date.start})`;
                }
                return `- ${taskName}${dateInfo}`;
            });

            if (tasks.length === 0) {
                return JSON.stringify({ status: "success", message: "Bảng Notion hiện đang trống (Không có nhiệm vụ nào)." });
            }

            return JSON.stringify({
                status: "success",
                tasks: tasks
            });
        }
        
        return JSON.stringify({ status: "error", message: "Invalid action" });

    } catch (error: any) {
        return JSON.stringify({
            status: "error",
            message: `Notion API Error: ${error.message}. (Gợi ý: Đảm bảo bảng Database Notion của bạn có cột tên là 'Name' định dạng Text/Title và Clawbot đã được 'Invite' vào bảng đó).`,
        });
    }
}
