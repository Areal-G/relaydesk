import { afterEach } from "vitest";
import { resetRateLimiters } from "@/server/rate-limit";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123456789";

afterEach(() => {
  resetRateLimiters();
});
