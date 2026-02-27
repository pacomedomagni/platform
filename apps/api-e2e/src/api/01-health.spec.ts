import axios from 'axios';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200', async () => {
      const res = await axios.get('/health');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when all dependencies are connected', async () => {
      const res = await axios.get('/health/ready');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 indicating the process is alive', async () => {
      const res = await axios.get('/health/live');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/metrics', () => {
    it('should return 200 with application metrics', async () => {
      const res = await axios.get('/health/metrics');

      expect(res.status).toBe(200);
    });
  });
});
