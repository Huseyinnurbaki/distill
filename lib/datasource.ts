import { Client } from 'pg';

const SSL_OPTIONS = { rejectUnauthorized: false };

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export type SchemaMap = Record<string, ColumnInfo[]>;

export async function introspectPostgres(connString: string): Promise<string> {
  const client = new Client({ connectionString: connString, ssl: SSL_OPTIONS });
  await client.connect();
  try {
    const res = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const schema: SchemaMap = {};
    for (const row of res.rows) {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable,
      });
    }
    return JSON.stringify(schema);
  } finally {
    await client.end();
  }
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
}

export async function executeQuery(connString: string, sql: string): Promise<QueryResult> {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
    throw new Error('Only SELECT or WITH queries are allowed');
  }

  const client = new Client({ connectionString: connString, ssl: SSL_OPTIONS });
  await client.connect();
  try {
    const res = await client.query(sql);
    const columns = res.fields.map((f: any) => f.name);
    const rows = res.rows.map((row: any) => columns.map((col: string) => row[col]));
    return { columns, rows, rowCount: res.rowCount ?? rows.length };
  } finally {
    await client.end();
  }
}
