import { Router } from 'express';
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

export const facilitiesRouter = Router();
facilitiesRouter.use(requireAuth);

facilitiesRouter.get('/', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
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
    res.json({ facilities: rows });
    return;
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
  res.json({ facilities: rows });
});

facilitiesRouter.post('/', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
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
  if (!id) {
    res.status(500).json({ error: 'Create failed' });
    return;
  }
  res.status(201).json({ id });
});

facilitiesRouter.get('/:id', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
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
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(row);
});

facilitiesRouter.put('/:id', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const b = parsed.data;
  const cur = (await sql`
    select name, region, mmda, meta
    from facilities
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as { name: string; region: string | null; mmda: string | null; meta: unknown }[];
  if (!cur[0]) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
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
  if (!rows[0]) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true, id: rows[0].id });
});
