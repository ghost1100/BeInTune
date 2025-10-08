import { test, expect } from "@playwright/test";

test("routes load and chats require auth", async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await expect(page).toHaveURL(/\//);
  // navigate to teachers
  await page.click("text=Teachers");
  await expect(page).toHaveURL(/\/teachers/);

  // go to chats (should redirect to login if not authenticated)
  await page.goto(`${baseURL}/chats`);
  // expect login prompt or redirect to admin/login or similar
  await expect(page).toHaveURL(/admin\/?/i);
});
