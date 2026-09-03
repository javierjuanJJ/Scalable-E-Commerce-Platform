import { z } from 'zod';

export const profileUpdateSchema = z.object({
  name: z.string().max(100, { message: 'Name must be at most 100 characters' }).optional(),
  avatarUrl: z.string().url({ message: 'Invalid URL format' }).max(500, { message: 'URL must be at most 500 characters' }).optional(),
}).strict();

export const adminUpdateSchema = z.object({
  name: z.string().max(100, { message: 'Name must be at most 100 characters' }).optional(),
  role: z.enum(['USER', 'ADMIN'], { message: 'Role must be USER or ADMIN' }).optional(),
  emailVerified: z.boolean().optional(),
}).strict();

export const deleteConfirmationSchema = z.object({
  password: z.string().min(1, { message: 'Password is required' }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'email', 'name', 'role']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type DeleteConfirmationInput = z.infer<typeof deleteConfirmationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;