import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Single-process repository. Never overwrite a corrupt store or acknowledge a failed write. */
export class AtomicRepository<T> {
  constructor(
    private file: string,
    private validate: (value: unknown) => T,
  ) {}
  read(seed: () => T): T {
    try {
      return this.validate(JSON.parse(fs.readFileSync(this.file, "utf8")));
    } catch (error: any) {
      if (error.code === "ENOENT") return seed();
      throw new Error("Investigation store is unreadable or invalid; restore from backup.", {
        cause: error,
      });
    }
  }
  write(value: T) {
    const directory = path.dirname(this.file);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${crypto.randomUUID()}.tmp`;
    let fd: number | undefined;
    try {
      fd = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(this.validate(value)));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temporary, this.file);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}
