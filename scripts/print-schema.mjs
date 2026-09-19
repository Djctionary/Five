// Prints the schema so it can be pasted into a SQL console.
import { schemaSql } from "../lib/schema.mjs";

process.stdout.write(schemaSql());
