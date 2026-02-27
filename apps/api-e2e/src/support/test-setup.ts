/* eslint-disable */
import axios from 'axios';

module.exports = async function () {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '3000';

  axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
  axios.defaults.headers.common['x-tenant-id'] =
    process.env.TEST_TENANT_ID || '8d334424-054e-4452-949c-21ecc1fff2c0';
  axios.defaults.validateStatus = () => true;
  axios.defaults.timeout = 15000;
};
