// scripts/backup-db.js
// Automated full database backup script for PostgreSQL / Neon
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Format SQL value safely for INSERT statements
function formatSqlValue(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === "object") {
    // JSON or array
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  // String escaping
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(__dirname, "../backups", `backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonTablesDir = path.join(backupDir, "tables-json");
  if (!fs.existsSync(jsonTablesDir)) {
    fs.mkdirSync(jsonTablesDir, { recursive: true });
  }

  console.log(`📦 Starting full database backup from Neon...`);
  console.log(`📁 Saving to: ${backupDir}\n`);

  const client = await pool.connect();
  try {
    // 1. Get all public tables
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tableNames = tablesRes.rows.map((r) => r.table_name);
    console.log(`📋 Found ${tableNames.length} tables in database:`);

    const fullDatabaseData = {
      backupTimestamp: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"),
      tableCounts: {},
      data: {},
    };

    let sqlDumpContent = `-- ========================================================\n`;
    sqlDumpContent += `-- ARG PLATFORM DATABASE BACKUP (POSTGRESQL / NEON)\n`;
    sqlDumpContent += `-- Created At: ${new Date().toISOString()}\n`;
    sqlDumpContent += `-- ========================================================\n\n`;
    sqlDumpContent += `SET client_encoding = 'UTF8';\n`;
    sqlDumpContent += `SET standard_conforming_strings = on;\n\n`;

    // Disable triggers during restore to bypass foreign key constraints
    sqlDumpContent += `-- Temporarily disable foreign key constraint checks during restore\n`;
    sqlDumpContent += `SET session_replication_role = 'replica';\n\n`;

    for (const tableName of tableNames) {
      const rowRes = await client.query(`SELECT * FROM "${tableName}"`);
      const rows = rowRes.rows;
      fullDatabaseData.tableCounts[tableName] = rows.length;
      fullDatabaseData.data[tableName] = rows;

      // Save individual table JSON
      const tableJsonPath = path.join(jsonTablesDir, `${tableName}.json`);
      fs.writeFileSync(tableJsonPath, JSON.stringify(rows, null, 2), "utf8");

      console.log(`  ✓ ${tableName.padEnd(28)} : ${rows.length} rows`);

      // Build SQL statements
      sqlDumpContent += `-- --------------------------------------------------------\n`;
      sqlDumpContent += `-- Table structure & data for "${tableName}" (${rows.length} rows)\n`;
      sqlDumpContent += `-- --------------------------------------------------------\n`;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const quotedColumns = columns.map((col) => `"${col}"`).join(", ");

        // Chunk inserts by 100 rows
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesList = chunk
            .map((row) => {
              const vals = columns.map((col) => formatSqlValue(row[col]));
              return `  (${vals.join(", ")})`;
            })
            .join(",\n");

          sqlDumpContent += `INSERT INTO "${tableName}" (${quotedColumns}) VALUES\n${valuesList}\nON CONFLICT DO NOTHING;\n\n`;
        }
      } else {
        sqlDumpContent += `-- (No rows to insert)\n\n`;
      }
    }

    // Re-enable triggers
    sqlDumpContent += `-- Re-enable triggers and foreign key checks\n`;
    sqlDumpContent += `SET session_replication_role = 'origin';\n`;
    sqlDumpContent += `-- ================= END OF BACKUP =================\n`;

    // 2. Save full combined JSON
    const fullJsonPath = path.join(backupDir, "full_database.json");
    fs.writeFileSync(fullJsonPath, JSON.stringify(fullDatabaseData, null, 2), "utf8");

    // 3. Save full SQL dump
    const sqlDumpPath = path.join(backupDir, "database_dump.sql");
    fs.writeFileSync(sqlDumpPath, sqlDumpContent, "utf8");

    // 4. Save a quick README inside the backup folder explaining how to restore
    const readmeContent = `# Database Backup (${new Date().toLocaleString()})

## Summary
- **Timestamp**: ${new Date().toISOString()}
- **Total Tables**: ${tableNames.length}
- **Row Counts**:
${Object.entries(fullDatabaseData.tableCounts)
  .map(([k, v]) => `  - ${k}: ${v} rows`)
  .join("\n")}

## Files in this Backup
1. **\`database_dump.sql\`**: Complete SQL script with INSERT statements for all rows. Can be run in psql, DBeaver, pgAdmin, or Neon SQL Editor.
2. **\`full_database.json\`**: Master JSON document containing all tables and all records.
3. **\`tables-json/\`**: Individual JSON files for every table for easy inspection or import.

## How to Restore
### Option A: Using psql CLI
\`\`\`bash
psql "<YOUR_DATABASE_URL>" -f database_dump.sql
\`\`\`

### Option B: Using DBeaver / pgAdmin / Neon Console
Open \`database_dump.sql\` in your SQL editor connected to the database and execute the script.
`;
    fs.writeFileSync(path.join(backupDir, "README.md"), readmeContent, "utf8");

    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`📄 SQL Dump:        ${sqlDumpPath}`);
    console.log(`📄 Master JSON:     ${fullJsonPath}`);
    console.log(`📁 Individual JSON: ${jsonTablesDir}`);
  } catch (err) {
    console.error("❌ Backup failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch((e) => {
  console.error(e);
  process.exit(1);
});
