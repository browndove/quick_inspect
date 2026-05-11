import { Hono } from 'hono';
import { z } from 'zod';
import { getSql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const createBody = z.object({
  name: z.string().min(1),
  region: z.string().optional().nullable(),
  mmda: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  region: z.string().optional().nullable(),
  mmda: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const facilities = new Hono<{
  Variables: { inspectorId: string; inspectorEmail: string };
}>();

facilities.use('*', requireAuth);

facilities.get('/', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const q = c.req.query('q')?.trim();
  if (q) {
    const like = `%${q}%`;
    const rows = (await sql`
      select id, name, region, mmda, meta, created_at
      from facilities
      where inspector_id = ${inspectorId}::uuid
        and (lower(name) like lower(${like}) or lower(coalesce(region,'')) like lower(${like}))
      order by created_at desc
      limit 100
    `) as {
      id: string;
      name: string;
      region: string | null;
      mmda: string | null;
      meta: unknown;
      created_at: string;
    }[];
    return c.json({ facilities: rows });
  }
  const rows = (await sql`
    select id, name, region, mmda, meta, created_at
    from facilities
    where inspector_id = ${inspectorId}::uuid
    order by created_at desc
    limit 100
  `) as {
    id: string;
    name: string;
    region: string | null;
    mmda: string | null;
    meta: unknown;
    created_at: string;
  }[];
  return c.json({ facilities: rows });
});

facilities.post('/', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const parsed = createBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const { name, region, mmda, meta } = parsed.data;
  const rows = (await sql`
    insert into facilities (inspector_id, name, region, mmda, meta)
    values (
      ${inspectorId}::uuid,
      ${name},
      ${region ?? null},
      ${mmda ?? null},
      ${JSON.stringify(meta ?? {})}::jsonb
    )
    returning id
  `) as { id: string }[];
  const id = rows[0]?.id;
  if (!id) return c.json({ error: 'Create failed' }, 500);
  return c.json({ id }, 201);
});

facilities.get('/:id', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const rows = (await sql`
    select id, name, region, mmda, meta, created_at, updated_at
    from facilities
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as {
    id: string;
    name: string;
    region: string | null;
    mmda: string | null;
    meta: unknown;
    created_at: string;
    updated_at: string;
  }[];
  const row = rows[0];
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

facilities.put('/:id', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = updateBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const b = parsed.data;
  const cur = (await sql`
    select name, region, mmda, meta
    from facilities
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as { name: string; region: string | null; mmda: string | null; meta: unknown }[];
  if (!cur[0]) return c.json({ error: 'Not found' }, 404);
  const name = b.name ?? cur[0].name;
  const region = b.region !== undefined ? b.region : cur[0].region;
  const mmda = b.mmda !== undefined ? b.mmda : cur[0].mmda;
  const meta = b.meta !== undefined ? b.meta : cur[0].meta;
  const rows = (await sql`
    update facilities
    set
      name = ${name},
      region = ${region},
      mmda = ${mmda},
      meta = ${JSON.stringify(meta)}::jsonb,
      updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    returning id
  `) as { id: string }[];
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true, id: rows[0].id });
});
