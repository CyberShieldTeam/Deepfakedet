import { expect, test } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

test("public demo is anonymous, static, and read-only", async ({ page, request, baseURL }) => {
  const observed: string[] = [];
  const statuses: number[] = [];
  page.on("request", (req) => observed.push(`${req.method()} ${req.url()}`));
  page.on("response", (res) => statuses.push(res.status()));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(await page.title()).toContain("Public Demo");
  await expect(page.getByText("STATIC · READ ONLY")).toBeVisible();
  await expect(page.getByText("This public demo does not run inference", { exact: false })).toBeVisible();
  await expect(page.getByRole("img", { name: /fictional software fixture notice/i })).toBeVisible();
  await expect.poll(() => page.locator(".image-frame img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1500);
  await expect(page.getByText("ACTUAL OUTPUT", { exact: true })).toBeVisible();

  for (const [name, heading] of [
    ["Claim context", "Context without a verdict"],
    ["Post patterns", "A synthetic post pattern"],
    ["Case summary", "A review aid, not a decision"],
    ["Media review", "A fictional image, inspected"],
  ]) {
    await page.getByRole("tab", { name: new RegExp(name) }).click();
    await expect(page.getByRole("tabpanel")).toContainText(heading);
  }

  await expect(page.locator("form, input, textarea, select, iframe, object, embed")).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("form-action 'none'");

  await page.waitForTimeout(100);
  expect(observed.length).toBeGreaterThan(3);
  expect(statuses.every((status) => status === 200)).toBe(true);
  for (const line of observed) {
    const [method, url] = line.split(" ");
    expect(method, line).toBe("GET");
    expect(new URL(url).origin, line).toBe(baseURL);
    expect(url, line).not.toMatch(/\/(api|auth|upload|investigations?)(\/|\?|$)/i);
  }

  const artifact = await request.get("/");
  const html = await artifact.text();
  expect(html).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|GOCSPX-[A-Za-z0-9_-]+|VERITAS_USERS|Authorization:\s*Bearer/i);
  expect(html).not.toMatch(/https?:\/\//i);

  const dist = resolve(process.cwd(), "public-demo/dist");
  const files = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    }))).flat();
  };
  for (const file of await files(dist)) {
    const content = await readFile(file);
    expect(content.toString("utf8"), file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|GOCSPX-[A-Za-z0-9_-]+|VERITAS_USERS|Authorization:\s*Bearer/i);
  }
  console.log(`Observed page requests: ${observed.join("; ")}`);
});
