import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 20,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<750"],
  },
};

const baseUrl = __ENV.API_BASE_URL || "http://localhost:3001";

export default function () {
  const health = http.get(`${baseUrl}/health`);
  check(health, {
    "health status is 200": (r) => r.status === 200,
  });

  const plans = http.get(`${baseUrl}/api/v1/billing/plans`);
  check(plans, {
    "plans status is 200": (r) => r.status === 200,
  });

  const invalidVerify = http.get(`${baseUrl}/api/v1/verify/not-a-valid-token`);
  check(invalidVerify, {
    "invalid token is rejected": (r) => r.status === 400 || r.status === 404,
  });

  sleep(1);
}
