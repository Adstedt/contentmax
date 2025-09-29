import { createClient } from './client';
import type { Database } from '@/types/database.types';

// Type aliases for easier use
export type Tables = Database['public']['Tables'];
export type Organization = Tables['organizations']['Row'];
export type User = Tables['users']['Row'];
export type Project = Tables['projects']['Row'];
export type TaxonomyNode = Tables['taxonomy_nodes']['Row'];
export type ContentItem = Tables['content_items']['Row'];
export type Template = Tables['templates']['Row'];
export type GenerationQueue = Tables['generation_queue']['Row'];

// Insert type aliases
export type InsertOrganization = Tables['organizations']['Insert'];
export type InsertUser = Tables['users']['Insert'];
export type InsertProject = Tables['projects']['Insert'];
export type InsertTaxonomyNode = Tables['taxonomy_nodes']['Insert'];
export type InsertContentItem = Tables['content_items']['Insert'];
export type InsertTemplate = Tables['templates']['Insert'];
export type InsertGenerationQueue = Tables['generation_queue']['Insert'];

// Update type aliases
export type UpdateOrganization = Tables['organizations']['Update'];
export type UpdateUser = Tables['users']['Update'];
export type UpdateProject = Tables['projects']['Update'];
export type UpdateTaxonomyNode = Tables['taxonomy_nodes']['Update'];
export type UpdateContentItem = Tables['content_items']['Update'];
export type UpdateTemplate = Tables['templates']['Update'];
export type UpdateGenerationQueue = Tables['generation_queue']['Update'];

/**
 * Get the current user from the session
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Get extended user profile
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

  return profile;
}

/**
 * Get the current user's organization
 */
export async function getCurrentOrganization() {
  const user = await getCurrentUser();
  if (!user?.organization_id) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.organization_id)
    .single();

  return data;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(roles: string[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Get projects for the current organization
 */
export async function getOrganizationProjects() {
  const org = await getCurrentOrganization();
  if (!org) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  return data || [];
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
}: {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization();

  const supabase = createClient();
  // TODO: Enable when audit_logs table is created with proper schema
  // await supabase.from('audit_logs').insert({
  //   user_id: user?.id,
  //   organization_id: org?.id,
  //   action,
  //   entity_type: entityType,
  //   entity_id: entityId,
  //   old_values: oldValues,
  //   new_values: newValues,
  // });
}

/**
 * Soft delete a record by setting deleted_at
 */
export async function softDelete(table: keyof Tables, id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (!error) {
    await createAuditLog({
      action: 'delete',
      entityType: table,
      entityId: id,
    });
  }

  return !error;
}

/**
 * Get paginated results from a table
 */
export async function getPaginated(
  table: keyof Tables,
  page: number = 1,
  pageSize: number = 20,
  filters?: Record<string, unknown>
) {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from(table).select('*', { count: 'exact' });

  // Apply filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }

  // Filter out soft-deleted records
  query = query.is('deleted_at', null);

  const { data, count, error } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  return {
    data: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
    error,
  };
}
