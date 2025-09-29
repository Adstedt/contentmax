import { IntegrationManager } from '@/lib/external/integration-manager';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('IntegrationManager', () => {
  let manager: IntegrationManager;
  const mockSupabaseUrl = 'https://test.supabase.co';
  const mockSupabaseKey = 'test-key';
  const mockEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock for each test
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    manager = new IntegrationManager(mockSupabaseUrl, mockSupabaseKey, mockEncryptionKey);
  });

  describe('encryption', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plainText = 'sensitive_token_123';

      // Access private methods for testing
      const encrypted = manager['encrypt'](plainText);
      const decrypted = manager['decrypt'](encrypted);

      expect(encrypted).not.toBe(plainText);
      expect(encrypted).toContain(':'); // Should have IV and auth tag
      expect(decrypted).toBe(plainText);
    });

    it('should handle empty strings', () => {
      const encrypted = manager['encrypt']('');
      const decrypted = manager['decrypt']('');

      expect(encrypted).toBe('');
      expect(decrypted).toBe('');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => {
        manager['decrypt']('invalid-format');
      }).toThrow('Invalid encrypted text format');
    });
  });

  describe('createConnection', () => {
    it('should create a new connection', async () => {
      const mockConnection = {
        id: 'conn-123',
        org_id: 'org-456',
        user_id: 'user-789',
        service_type: 'google_analytics',
        connection_name: 'Test GA4',
        connection_status: 'pending',
      };

      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.single.mockResolvedValue({
        data: mockConnection,
        error: null,
      });

      const result = await manager.createConnection('org-456', 'user-789', {
        service_type: 'google_analytics',
        connection_name: 'Test GA4',
      });

      expect(result).toEqual(mockConnection);
    });

    it('should throw error on creation failure', async () => {
      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await expect(
        manager.createConnection('org-456', 'user-789', {
          service_type: 'google_analytics',
          connection_name: 'Test GA4',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateTokens', () => {
    it('should encrypt and store tokens', async () => {
      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.eq.mockResolvedValue({ error: null });

      await manager.updateTokens('conn-123', {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        expires_at: new Date('2024-12-31'),
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          encrypted_access_token: expect.any(String),
          encrypted_refresh_token: expect.any(String),
          token_expires_at: '2024-12-31T00:00:00.000Z',
          connection_status: 'active',
          last_error: null,
        })
      );

      // Verify tokens are encrypted
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.encrypted_access_token).not.toBe('access_token_value');
      expect(updateCall.encrypted_refresh_token).not.toBe('refresh_token_value');
    });
  });

  describe('getDecryptedTokens', () => {
    it('should retrieve and decrypt tokens', async () => {
      const accessToken = 'test_access_token';
      const refreshToken = 'test_refresh_token';

      // Encrypt tokens using the manager
      const encryptedAccess = manager['encrypt'](accessToken);
      const encryptedRefresh = manager['encrypt'](refreshToken);

      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.single.mockResolvedValue({
        data: {
          encrypted_access_token: encryptedAccess,
          encrypted_refresh_token: encryptedRefresh,
          token_expires_at: '2024-12-31T00:00:00.000Z',
        },
        error: null,
      });

      const tokens = await manager.getDecryptedTokens('conn-123');

      expect(tokens).toEqual({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date('2024-12-31T00:00:00.000Z'),
      });
    });

    it('should return null if no tokens found', async () => {
      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      const tokens = await manager.getDecryptedTokens('conn-123');
      expect(tokens).toBeNull();
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update connection status with error', async () => {
      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.eq.mockResolvedValue({ error: null });

      await manager.updateConnectionStatus('conn-123', 'error', 'Test error');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_status: 'error',
          last_error: 'Test error',
          updated_at: expect.any(String),
        })
      );
    });

    it('should update connection status to active', async () => {
      const mockSupabase = (createClient as jest.Mock).mock.results[0].value;
      mockSupabase.eq.mockResolvedValue({ error: null });

      await manager.updateConnectionStatus('conn-123', 'active');

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_status: 'active',
          last_error: null,
          last_sync_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
    });
  });

  describe('refreshTokenIfNeeded', () => {
    it('should not refresh if token is still valid', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const tokens = {
        access_token: 'valid_token',
        refresh_token: 'refresh_token',
        expires_at: futureDate,
      };

      // Mock getDecryptedTokens
      jest.spyOn(manager, 'getDecryptedTokens').mockResolvedValue(tokens);

      const refreshCallback = jest.fn();
      const result = await manager.refreshTokenIfNeeded('conn-123', refreshCallback);

      expect(refreshCallback).not.toHaveBeenCalled();
      expect(result).toEqual(tokens);
    });

    it('should refresh if token is near expiry', async () => {
      const nearExpiryDate = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
      const oldTokens = {
        access_token: 'old_token',
        refresh_token: 'refresh_token',
        expires_at: nearExpiryDate,
      };

      const newTokens = {
        access_token: 'new_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      };

      jest.spyOn(manager, 'getDecryptedTokens').mockResolvedValue(oldTokens);
      jest.spyOn(manager, 'updateTokens').mockResolvedValue(undefined);

      const refreshCallback = jest.fn().mockResolvedValue(newTokens);
      const result = await manager.refreshTokenIfNeeded('conn-123', refreshCallback);

      expect(refreshCallback).toHaveBeenCalledWith('refresh_token');
      expect(manager.updateTokens).toHaveBeenCalledWith('conn-123', newTokens);
      expect(result).toEqual(newTokens);
    });

    it('should handle refresh failure', async () => {
      const expiredTokens = {
        access_token: 'expired_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() - 1000), // Already expired
      };

      jest.spyOn(manager, 'getDecryptedTokens').mockResolvedValue(expiredTokens);
      jest.spyOn(manager, 'updateConnectionStatus').mockResolvedValue(undefined);

      const refreshCallback = jest.fn().mockRejectedValue(new Error('Refresh failed'));

      await expect(manager.refreshTokenIfNeeded('conn-123', refreshCallback)).rejects.toThrow(
        'Refresh failed'
      );

      expect(manager.updateConnectionStatus).toHaveBeenCalledWith(
        'conn-123',
        'error',
        'Token refresh failed: Refresh failed'
      );
    });
  });
});
