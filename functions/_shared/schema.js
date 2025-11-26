import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    email: text('email').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const userSheets = sqliteTable('user_sheets', {
    sheetId: text('sheet_id').primaryKey(),
    userEmail: text('user_email').references(() => users.email),
    sheetName: text('sheet_name'),
    spreadsheetId: text('spreadsheet_id'),
    role: text('role'),
    createdBy: text('created_by'),
    lastAccessed: integer('last_accessed', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => ({
    userEmailIdx: index('idx_user_email').on(table.userEmail),
}));
