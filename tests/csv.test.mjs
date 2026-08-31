import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../scripts/lib/csv.mjs";

test("parseCsv 可以解析普通 CSV 行", () => {
  assert.deepEqual(parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
});

test("parseCsv 可以解析引号中的逗号和转义双引号", () => {
  assert.deepEqual(
    parseCsv('a,b\n"hello, world","say ""hi"""\n'),
    [["a", "b"], ["hello, world", 'say "hi"']],
  );
});

test("parseCsv 支持引号字段中的换行", () => {
  assert.deepEqual(
    parseCsv('a,b\n"line 1\nline 2",x\n'),
    [["a", "b"], ["line 1\nline 2", "x"]],
  );
});
