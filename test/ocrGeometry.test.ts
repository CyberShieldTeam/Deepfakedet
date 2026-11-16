import assert from "node:assert/strict";
import { mappedBox } from "../server/ocrGeometry";
import { parseOcrTsv, proposeCandidates } from "../server/extraction";
assert.deepEqual(mappedBox({ x: 10, y: 20, width: 30, height: 40 }, [0, -2, 200, 2, 0, 0]), {
  x: 80,
  y: 20,
  width: 80,
  height: 60,
});
assert.deepEqual(mappedBox({ x: 10, y: 20, width: 30, height: 40 }, [-1, 0, 100, 0, 1, 0]), {
  x: 60,
  y: 20,
  width: 30,
  height: 40,
});
assert.throws(
  () => mappedBox({ x: 0, y: 0, width: 1, height: 1 }, [NaN, 0, 0, 0, 1, 0]),
  /Invalid/,
);
assert.throws(() => mappedBox({ x: 0, y: 0, width: 1, height: 1 }, [0, 0, 0, 0, 0, 0]), /Invalid/);
const dense =
  "header\n" +
  Array.from(
    { length: 40 },
    (_, i) => `5\t1\t1\t1\t${i + 1}\t1\t0\t${i * 2}\t50\t1\t80\tAuthored museum text ${i}.`,
  ).join("\n");
const partial = parseOcrTsv(dense, 100, 100);
assert.equal(partial.truncated, true);
assert.equal(partial.segments.length, 32);
assert.equal(proposeCandidates("case", partial.segments).truncated, true);
console.log(
  "Source/display affine box controls passed: rotated corners, scaling, mirrors and invalid mapping.",
);
