import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "45s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
  },
};

const baseUrl = __ENV.API_BASE_URL || "http://localhost:3001";
const token = __ENV.ACCESS_TOKEN;
const projectId = __ENV.PROJECT_ID;

if (!token || !projectId) {
  throw new Error("ACCESS_TOKEN and PROJECT_ID must be set for this scenario.");
}

const headers = {
  headers: {
    Authorization: `Bearer ${token}`,
  },
};

export default function () {
  const project = http.get(`${baseUrl}/api/v1/projects/${projectId}`, headers);
  check(project, {
    "project read status is 200": (r) => r.status === 200,
  });

  const stats = http.get(`${baseUrl}/api/v1/projects/${projectId}/verifications/stats`, headers);
  check(stats, {
    "stats status is 200": (r) => r.status === 200,
  });

  const subscription = http.get(
    `${baseUrl}/api/v1/billing/subscription?projectId=${projectId}`,
    headers,
  );
  check(subscription, {
    "subscription status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
