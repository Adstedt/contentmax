'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Globe, Key, Save, X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100),
  phone_number: z.string().optional(),
  timezone: z.string(),
  notification_preferences: z.object({
    email_invitations: z.boolean(),
    email_content_updates: z.boolean(),
    email_team_updates: z.boolean(),
    email_product_imports: z.boolean(),
    in_app_invitations: z.boolean(),
    in_app_content_updates: z.boolean(),
    in_app_team_updates: z.boolean(),
    in_app_product_imports: z.boolean(),
  }),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function ProfileTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone_number: '',
      timezone: 'America/New_York',
      notification_preferences: {
        email_invitations: true,
        email_content_updates: true,
        email_team_updates: true,
        email_product_imports: true,
        in_app_invitations: true,
        in_app_content_updates: true,
        in_app_team_updates: true,
        in_app_product_imports: true,
      },
    },
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select(
          `
          *,
          workspace_members!inner(
            role,
            workspace:organizations(name)
          )
        `
        )
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUserData(data);
      reset({
        full_name: data.full_name || '',
        phone_number: data.phone_number || '',
        timezone: data.timezone || 'America/New_York',
        notification_preferences: data.notification_preferences || {
          email_invitations: true,
          email_content_updates: true,
          email_team_updates: true,
          email_product_imports: true,
          in_app_invitations: true,
          in_app_content_updates: true,
          in_app_team_updates: true,
          in_app_product_imports: true,
        },
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          phone_number: data.phone_number,
          timezone: data.timezone,
          notification_preferences: data.notification_preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserData({ ...userData, ...data });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No email found');

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      toast.success('Password reset email sent. Please check your inbox.');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset email');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
      </div>
    );
  }

  const roleConfig: Record<string, { label: string; color: string }> = {
    owner: { label: 'Owner', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    editor: { label: 'Editor', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
    viewer: { label: 'Viewer', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  };

  const userRole = userData?.workspace_members?.[0]?.role || 'viewer';
  const roleStyle = roleConfig[userRole];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Profile Information</h2>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-md transition-colors"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                reset();
              }}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-md transition-colors flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] disabled:opacity-50 text-white rounded-md transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Avatar Section */}
        <div className="col-span-2 flex items-center space-x-6">
          <div className="h-24 w-24 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <User className="h-12 w-12 text-[#666]" />
          </div>
          <div>
            {isEditing ? (
              <div>
                <input
                  {...register('full_name')}
                  className="text-lg font-medium bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1 text-white focus:outline-none focus:border-[#10a37f]"
                  placeholder="Enter your name"
                />
                {errors.full_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
                )}
              </div>
            ) : (
              <h3 className="text-lg font-medium">{userData?.full_name || 'No name set'}</h3>
            )}
            <p className="text-[#999] flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full border ${roleStyle.color}`}
              >
                {roleStyle.label}
              </span>
              {userData?.workspace_members?.[0]?.workspace?.name && (
                <span className="text-sm">• {userData.workspace_members[0].workspace.name}</span>
              )}
            </p>
          </div>
        </div>

        {/* Information Fields */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-[#666]" />
            <div className="flex-1">
              <p className="text-sm text-[#999]">Email</p>
              <p className="text-white">{userData?.email || 'No email'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Phone className="h-5 w-5 text-[#666]" />
            <div className="flex-1">
              <p className="text-sm text-[#999]">Phone</p>
              {isEditing ? (
                <input
                  {...register('phone_number')}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1 text-white w-full focus:outline-none focus:border-[#10a37f]"
                  placeholder="+1 (555) 123-4567"
                />
              ) : (
                <p className="text-white">{userData?.phone_number || 'Not set'}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Globe className="h-5 w-5 text-[#666]" />
            <div className="flex-1">
              <p className="text-sm text-[#999]">Timezone</p>
              {isEditing ? (
                <select
                  {...register('timezone')}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-1 text-white w-full focus:outline-none focus:border-[#10a37f]"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white">{userData?.timezone || 'America/New_York'}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Key className="h-5 w-5 text-[#666]" />
            <div>
              <p className="text-sm text-[#999]">Password</p>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="text-[#10a37f] hover:text-[#0e8a65] transition-colors"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="mt-8 pt-8 border-t border-[#2a2a2a]">
        <h3 className="text-lg font-medium mb-4">Notification Preferences</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Email Notifications</h4>
            <div className="space-y-3">
              {[
                { key: 'email_invitations', label: 'Team invitations' },
                { key: 'email_content_updates', label: 'Content updates' },
                { key: 'email_team_updates', label: 'Team updates' },
                { key: 'email_product_imports', label: 'Product imports' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-[#999]">{label}</span>
                  <div className="relative inline-block w-12 h-6">
                    <input
                      type="checkbox"
                      {...register(`notification_preferences.${key as any}`)}
                      disabled={!isEditing}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-[#2a2a2a] peer-checked:bg-[#10a37f] rounded-full transition-colors peer-disabled:opacity-50"></div>
                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-white mb-3">In-App Notifications</h4>
            <div className="space-y-3">
              {[
                { key: 'in_app_invitations', label: 'Team invitations' },
                { key: 'in_app_content_updates', label: 'Content updates' },
                { key: 'in_app_team_updates', label: 'Team updates' },
                { key: 'in_app_product_imports', label: 'Product imports' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-[#999]">{label}</span>
                  <div className="relative inline-block w-12 h-6">
                    <input
                      type="checkbox"
                      {...register(`notification_preferences.${key as any}`)}
                      disabled={!isEditing}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-[#2a2a2a] peer-checked:bg-[#10a37f] rounded-full transition-colors peer-disabled:opacity-50"></div>
                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
