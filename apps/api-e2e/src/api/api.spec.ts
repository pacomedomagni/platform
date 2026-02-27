import axios from 'axios';

describe('GET /health', () => {
  it('should return a healthy status', async () => {
    const res = await axios.get('/health/ready');

    expect(res.status).toBe(200);
  });
});
