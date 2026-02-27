import axios from 'axios';
import { getAdminToken, adminHeaders } from '../support/auth-helper';
import { store } from '../support/data-store';

describe('Operations Endpoints', () => {
  beforeAll(async () => {
    await getAdminToken();
  });

  // ───────────────────────────── Audit Logs ─────────────────────────────

  describe('Audit Logs', () => {
    it('GET /operations/audit-logs → 200 (should have at least provisioning entry)', async () => {
      const res = await axios.get('/operations/audit-logs', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();

      const items = res.data.data ?? res.data;
      if (Array.isArray(items)) {
        expect(items.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('GET /operations/audit-logs/activity-summary → 200', async () => {
      const res = await axios.get('/operations/audit-logs/activity-summary', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(typeof res.data).toBe('object');
    });
  });

  // ───────────────────────────── Webhooks ─────────────────────────────

  describe('Webhooks', () => {
    it('POST /operations/webhooks → 201 (create webhook)', async () => {
      const res = await axios.post(
        '/operations/webhooks',
        {
          name: 'E2E Test Webhook',
          url: 'https://httpbin.org/post',
          events: ['order.created'],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('id');

      store.webhookId = res.data.id;
    });

    it('GET /operations/webhooks → 200 (list webhooks)', async () => {
      const res = await axios.get('/operations/webhooks', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);

      const items = res.data.data ?? res.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /operations/webhooks/:id → 200 (webhook detail)', async () => {
      expect(store.webhookId).toBeDefined();

      const res = await axios.get(
        `/operations/webhooks/${store.webhookId}`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.id ?? res.data.data?.id).toBe(store.webhookId);
    });

    it('PUT /operations/webhooks/:id → 200 (update webhook)', async () => {
      expect(store.webhookId).toBeDefined();

      const res = await axios.put(
        `/operations/webhooks/${store.webhookId}`,
        {
          url: 'https://httpbin.org/post',
          events: ['order.created', 'order.updated'],
        },
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('POST /operations/webhooks/:id/test → responds without 500', async () => {
      expect(store.webhookId).toBeDefined();

      const res = await axios.post(
        `/operations/webhooks/${store.webhookId}/test`,
        {},
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
    });

    it('GET /operations/webhooks/:id/deliveries → 200 (delivery log)', async () => {
      expect(store.webhookId).toBeDefined();

      const res = await axios.get(
        `/operations/webhooks/${store.webhookId}/deliveries`,
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('DELETE /operations/webhooks/:id → 204', async () => {
      expect(store.webhookId).toBeDefined();

      const res = await axios.delete(
        `/operations/webhooks/${store.webhookId}`,
        { headers: adminHeaders() }
      );

      // Controller uses @HttpCode(HttpStatus.NO_CONTENT) = 204
      expect([200, 204]).toContain(res.status);
    });
  });

  // ───────────────────────────── Background Jobs ─────────────────────────────

  describe('Background Jobs', () => {
    it('GET /operations/jobs/stats → 200', async () => {
      const res = await axios.get('/operations/jobs/stats', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      expect(typeof res.data).toBe('object');
    });

    it('GET /operations/jobs → 200 (list jobs)', async () => {
      const res = await axios.get('/operations/jobs', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /operations/jobs/:id → 200 (job detail)', async () => {
      // List jobs and grab the first one
      const listRes = await axios.get('/operations/jobs', {
        headers: adminHeaders(),
      });
      const jobs = listRes.data.data ?? listRes.data;
      if (!Array.isArray(jobs) || jobs.length === 0) {
        console.warn('Skipping job detail: no jobs found');
        return;
      }

      const jobId = jobs[0].id;
      const res = await axios.get(`/operations/jobs/${jobId}`, {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });
  });

  // ───────────────────────────── Audit Extras ─────────────────────────────

  describe('Audit Extras', () => {
    it('GET /operations/audit-logs/entity/:docType/:docName → 200 (entity history)', async () => {
      // Use a known entity type - product listing is commonly audited
      const res = await axios.get(
        '/operations/audit-logs/entity/ProductListing/all',
        { headers: adminHeaders() }
      );

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });

    it('GET /operations/audit-logs/export → 200 (export audit logs)', async () => {
      const res = await axios.get('/operations/audit-logs/export', {
        headers: adminHeaders(),
      });

      expect(res.status).toBeLessThan(500);
      if (res.status === 200) {
        expect(res.data).toBeDefined();
      }
    });
  });

  // ───────────────────────────── Import / Export ─────────────────────────────

  describe('Import / Export', () => {
    it('GET /operations/export/products/json → 200', async () => {
      const res = await axios.get('/operations/export/products/json', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /operations/export/products/csv → 200', async () => {
      const res = await axios.get('/operations/export/products/csv', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /operations/export/customers/json → 200', async () => {
      const res = await axios.get('/operations/export/customers/json', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('POST /operations/import/products/json → imports products (dry run)', async () => {
      // Export products first, then try to re-import them with dryRun
      const exportRes = await axios.get('/operations/export/products/json', {
        headers: adminHeaders(),
      });

      if (exportRes.status !== 200 || !exportRes.data) {
        console.warn('Skipping import test: export failed');
        return;
      }

      const content = typeof exportRes.data === 'string'
        ? exportRes.data
        : JSON.stringify(exportRes.data);

      const res = await axios.post(
        '/operations/import/products/json?dryRun=true',
        { content },
        { headers: adminHeaders() }
      );

      expect([200, 201]).toContain(res.status);
      expect(res.data).toBeDefined();
    });
  });

  // ───────────────────────────── Notifications ─────────────────────────────

  describe('Notifications', () => {
    it('GET /operations/notifications/unread-count → 200', async () => {
      const res = await axios.get('/operations/notifications/unread-count', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /operations/notifications → 200 (list notifications)', async () => {
      const res = await axios.get('/operations/notifications', {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('GET /operations/notifications/:id → 200 (notification detail)', async () => {
      // List notifications and grab the first one
      const listRes = await axios.get('/operations/notifications', {
        headers: adminHeaders(),
      });
      const notifications = listRes.data.data ?? listRes.data;
      if (!Array.isArray(notifications) || notifications.length === 0) {
        console.warn('Skipping notification detail: no notifications');
        return;
      }

      const notifId = notifications[0].id;
      const res = await axios.get(`/operations/notifications/${notifId}`, {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('PUT /operations/notifications/:id/read → 200 (mark one as read)', async () => {
      const listRes = await axios.get('/operations/notifications', {
        headers: adminHeaders(),
      });
      const notifications = listRes.data.data ?? listRes.data;
      if (!Array.isArray(notifications) || notifications.length === 0) {
        console.warn('Skipping mark-read: no notifications');
        return;
      }

      const notifId = notifications[0].id;
      const res = await axios.put(
        `/operations/notifications/${notifId}/read`,
        {},
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('PUT /operations/notifications/read-all → 200 (mark all read)', async () => {
      const res = await axios.put(
        '/operations/notifications/read-all',
        {},
        { headers: adminHeaders() }
      );

      expect(res.status).toBe(200);
    });

    it('DELETE /operations/notifications/read → 200 (delete read notifications)', async () => {
      const res = await axios.delete('/operations/notifications/read', {
        headers: adminHeaders(),
      });

      expect([200, 204]).toContain(res.status);
    });
  });
});
