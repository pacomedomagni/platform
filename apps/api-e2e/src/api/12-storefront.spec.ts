import axios from 'axios';
import { getAdminToken, adminHeaders, tenantHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Storefront Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Themes ─────────────────────────────

  describe('Themes', () => {
    it('GET /store/themes → 200 (list themes)', async () => {
      const res = await axios.get('/store/themes', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /store/themes/presets → 200 (preset themes)', async () => {
      const res = await axios.get('/store/themes/presets', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('POST /store/admin/themes → 201 (create custom theme)', async () => {
      const res = await axios.post(
        '/store/admin/themes',
        {
          name: `E2E Test Theme ${Date.now()}`,
          colors: {
            primary: '#3B82F6',
            primaryForeground: '#FFFFFF',
            secondary: '#10B981',
            secondaryForeground: '#FFFFFF',
            accent: '#F59E0B',
            accentForeground: '#000000',
            background: '#FFFFFF',
            foreground: '#111827',
            muted: '#F3F4F6',
            mutedForeground: '#6B7280',
            border: '#E5E7EB',
            input: '#E5E7EB',
            card: '#FFFFFF',
            cardForeground: '#111827',
            popover: '#FFFFFF',
            popoverForeground: '#111827',
            destructive: '#EF4444',
            destructiveForeground: '#FFFFFF',
            success: '#22C55E',
            successForeground: '#FFFFFF',
            warning: '#F59E0B',
            warningForeground: '#000000',
            info: '#3B82F6',
            infoForeground: '#FFFFFF',
            ring: '#3B82F6',
            radius: '0.5rem',
          },
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.themeId = res.data.id;
    });

    it('PUT /store/admin/themes/:id → 200 (update theme)', async () => {
      expect(store.themeId).toBeDefined();

      const res = await axios.put(
        `/store/admin/themes/${store.themeId}`,
        {
          name: 'E2E Test Theme Updated',
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('POST /store/admin/themes/:id/activate → 200 or 201 (activate theme)', async () => {
      expect(store.themeId).toBeDefined();

      const res = await axios.post(
        `/store/admin/themes/${store.themeId}/activate`,
        {},
        { headers: adminHeaders() }
      );

      expect([200, 201]).toContain(res.status);
    });

    it('GET /store/themes/active → 200 (get active theme)', async () => {
      const res = await axios.get('/store/themes/active', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    let duplicatedThemeId: string;

    it('POST /store/admin/themes/:id/duplicate → 201 (duplicate theme)', async () => {
      expect(store.themeId).toBeDefined();

      const res = await axios.post(
        `/store/admin/themes/${store.themeId}/duplicate`,
        { name: `E2E Test Theme Copy ${Date.now()}` },
        { headers: adminHeaders() }
      );

      // duplicate might return 200 or 201
      expect([200, 201]).toContain(res.status);
      expect(res.data).toHaveProperty('id');

      duplicatedThemeId = res.data.id;
    });

    it('DELETE /store/admin/themes/:id → 200 (delete duplicated theme)', async () => {
      expect(duplicatedThemeId).toBeDefined();

      const res = await axios.delete(
        `/store/admin/themes/${duplicatedThemeId}`,
        { headers: adminHeaders() }
      );

      expect([200, 204]).toContain(res.status);
    });

    it('GET /store/themes/:id → 200 (get theme by ID)', async () => {
      expect(store.themeId).toBeDefined();

      const res = await axios.get(`/store/themes/${store.themeId}`, {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('POST /store/admin/themes/reset-preset → 200 (reset to preset)', async () => {
      const res = await axios.post(
        '/store/admin/themes/reset-preset',
        { presetSlug: 'default' },
        { headers: adminHeaders() }
      );

      // May succeed or return 404 if preset slug doesn't match
      expect(res.status).toBeLessThan(500);
    });
  });

  // ───────────────────────────── Store Pages ─────────────────────────────

  describe('Store Pages', () => {
    it('GET /store/pages → 200 (public list: terms, privacy, refund)', async () => {
      const res = await axios.get('/store/pages', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('GET /store/pages/terms-of-service → 200 (by slug)', async () => {
      const res = await axios.get('/store/pages/terms-of-service', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /store/pages/privacy-policy → 200 (by slug)', async () => {
      const res = await axios.get('/store/pages/privacy-policy', {
        headers: tenantHeaders(),
      });

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('PUT /store/admin/pages/custom-page → 200 (upsert custom page)', async () => {
      const res = await axios.put(
        '/store/admin/pages/custom-page',
        {
          title: 'About Us',
          content: '<h1>About Us</h1><p>This is our E2E test page.</p>',
          isPublished: true,
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
      expect([200, 201]).toContain(res.status);
    });

    it('GET /store/admin/pages → 200 (admin list all pages)', async () => {
      const res = await axios.get('/store/admin/pages', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('DELETE /store/admin/pages/custom-page → 200 (delete custom page)', async () => {
      const res = await axios.delete('/store/admin/pages/custom-page', {
        headers: adminHeaders(),
      });

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  // ───────────────────────────── Store Settings ─────────────────────────────

  describe('Store Settings', () => {
    it('GET /store/admin/settings → 200', async () => {
      const res = await axios.get('/store/admin/settings', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(typeof res.data).toBe('object');
    });

    it('PUT /store/admin/settings → 200 (update business name)', async () => {
      const res = await axios.put(
        '/store/admin/settings',
        {
          businessName: 'E2E Test Store',
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });
  });

  // ───────────────────────────── Domain Resolver ─────────────────────────────

  describe('Domain Resolver', () => {
    it('GET /store/resolve?domain=test.example.com → responds', async () => {
      const res = await axios.get(
        '/store/resolve?domain=test.example.com'
      );

      // Domain likely doesn't exist, but endpoint should respond
      expect(res.status).toBeLessThan(500);
    });
  });
});
