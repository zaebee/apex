import { expect, test } from "bun:test";

test("harness runs typescript under bun", () => {
  const strict: string = "ok";
  expect(strict).toBe("ok");
});
