import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || process.env.REDIS || null;
const connection = redisUrl
  ? { connection: redisUrl }
  : ({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT
        ? parseInt(process.env.REDIS_PORT, 10)
        : 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    } as any);

export const bookingQueue = new Queue("bookingQueue", {
  connection,
});

export async function addBookingJob(data: any) {
  // attempts and backoff for reliability
  return bookingQueue.add("processBooking", data, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}
