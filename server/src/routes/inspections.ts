import { Hono } from 'hono';
import { z } from 'zod';
import { getSql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

type InspectionRow = {
  id: string;
  inspector_id: string;
  facility_id: string | null;
  type: string;
  status: string;
  data: unknown;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

function mapInspection(r: InspectionRow) {
  return {
    id: r.id,
    inspectorId: r.inspector_id,
    facilityId: r.facility_id,
    type: r.type,
    status: r.status,
    data: r.data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    submittedAt: r.submitted_at,
  };
}

const createBody = z.object({
  facilityId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const updateBody = z.object({
  facilityId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const statusBody = z.object({
  status: z.enum(['draft', 'submitted', 'signed']),
});

const staffCreateBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

const staffUpdateBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

const responsesBulkBody = z.object({
  items: z.array(
    z.object({
      questionKey: z.string().min(1),
      value: z.unknown().optional(),
      flagged: z.boolean().optional(),
    }),
  ),
});

const flagBody = z.object({
  flagged: z.boolean(),
});

const signoffBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const inspections = new Hono<{
  Variables: { inspectorId: string; inspectorEmail: string };
}>();

inspections.use('*', requireAuth);

async function assertFacilityOwned(
  sql: ReturnType<typeof getSql>,
  inspectorId: string,
  facilityId: string,
): Promise<boolean> {
  const rows = (await sql`
    select id from facilities
    where id = ${facilityId}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as { id: string }[];
  return Boolean(rows[0]);
}

async function getInspection(
  sql: ReturnType<typeof getSql>,
  inspectorId: string,
  id: string,
): Promise<InspectionRow | null> {
  const rows = (await sql`
    select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
    from inspections
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as InspectionRow[];
  return rows[0] ?? null;
}

inspections.get('/', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const status = c.req.query('status')?.trim();
  const facilityId = c.req.query('facilityId')?.trim();
  const allowed = ['draft', 'submitted', 'signed'] as const;
  const statusFilter =
    status && (allowed as readonly string[]).includes(status) ? status : null;

  if (statusFilter && facilityId) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid
        and status = ${statusFilter}
        and facility_id = ${facilityId}::uuid
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    return c.json({ inspections: rows.map(mapInspection) });
  }
  if (statusFilter) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid and status = ${statusFilter}
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    return c.json({ inspections: rows.map(mapInspection) });
  }
  if (facilityId) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid and facility_id = ${facilityId}::uuid
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    return c.json({ inspections: rows.map(mapInspection) });
  }
  const rows = (await sql`
    select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
    from inspections
    where inspector_id = ${inspectorId}::uuid
    order by created_at desc
    limit 200
  `) as InspectionRow[];
  return c.json({ inspections: rows.map(mapInspection) });
});

inspections.post('/', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const parsed = createBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const { facilityId, type, data } = parsed.data;
  if (facilityId) {
    const ok = await assertFacilityOwned(sql, inspectorId, facilityId);
    if (!ok) return c.json({ error: 'Facility not found' }, 404);
  }
  const rows = (await sql`
    insert into inspections (inspector_id, facility_id, type, data)
    values (
      ${inspectorId}::uuid,
      ${facilityId ?? null},
      ${type ?? 'pharmacy_routine'},
      ${JSON.stringify(data ?? {})}::jsonb
    )
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const row = rows[0];
  if (!row) return c.json({ error: 'Create failed' }, 500);
  return c.json(mapInspection(row), 201);
});

inspections.get('/:id/export/pdf', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(
    {
      error: 'PDF export not implemented yet',
      inspectionId: id,
      hint: 'Wire a server-side renderer (e.g. pdfkit / puppeteer) and return application/pdf',
    },
    501,
  );
});

inspections.patch('/:id/submit', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.status !== 'draft') {
    return c.json({ error: 'Only draft inspections can be submitted' }, 400);
  }
  const rows = (await sql`
    update inspections
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid and status = 'draft'
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) return c.json({ error: 'Submit failed' }, 409);
  return c.json(mapInspection(next));
});

inspections.patch('/:id/status', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = statusBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const { status } = parsed.data;
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const submittedAt =
    status === 'draft'
      ? null
      : row.submitted_at ?? new Date().toISOString();
  const rows = (await sql`
    update inspections
    set
      status = ${status},
      submitted_at = ${submittedAt},
      updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) return c.json({ error: 'Update failed' }, 500);
  return c.json(mapInspection(next));
});

inspections.delete('/:id', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.status !== 'draft') {
    return c.json({ error: 'Only draft inspections can be deleted' }, 400);
  }
  await sql`
    delete from inspections
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid and status = 'draft'
  `;
  return c.body(null, 204);
});

inspections.post('/:id/staff', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = staffCreateBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const rows = (await sql`
    insert into inspection_staff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(parsed.data.data)}::jsonb)
    returning id
  `) as { id: string }[];
  const sid = rows[0]?.id;
  if (!sid) return c.json({ error: 'Create failed' }, 500);
  return c.json({ id: sid }, 201);
});

inspections.get('/:id/staff', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const staff = (await sql`
    select id, data, created_at, updated_at
    from inspection_staff
    where inspection_id = ${id}::uuid
    order by created_at asc
  `) as { id: string; data: unknown; created_at: string; updated_at: string }[];
  return c.json({ staff });
});

inspections.put('/:id/staff/:sid', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  const parsed = staffUpdateBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  const cur = (await sql`
    select data from inspection_staff
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
    limit 1
  `) as { data: Record<string, unknown> }[];
  if (!cur[0]) return c.json({ error: 'Staff row not found' }, 404);
  const merged = { ...cur[0].data, ...parsed.data.data };
  const rows = (await sql`
    update inspection_staff
    set data = ${JSON.stringify(merged)}::jsonb, updated_at = now()
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
    returning id
  `) as { id: string }[];
  if (!rows[0]) return c.json({ error: 'Update failed' }, 404);
  return c.json({ ok: true, id: rows[0].id });
});

inspections.delete('/:id/staff/:sid', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  await sql`
    delete from inspection_staff
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
  `;
  return c.body(null, 204);
});

inspections.post('/:id/responses', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = responsesBulkBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  for (const item of parsed.data.items) {
    const existing = (await sql`
      select value, flagged from inspection_responses
      where inspection_id = ${id}::uuid and question_key = ${item.questionKey}
      limit 1
    `) as { value: unknown; flagged: boolean }[];
    const cur = existing[0];
    const nextValue = item.value !== undefined ? item.value : cur?.value ?? null;
    const nextFlag = item.flagged !== undefined ? item.flagged : cur?.flagged ?? false;
    await sql`
      insert into inspection_responses (inspection_id, question_key, value, flagged, updated_at)
      values (${id}::uuid, ${item.questionKey}, ${JSON.stringify(nextValue)}::jsonb, ${nextFlag}, now())
      on conflict (inspection_id, question_key) do update
      set
        value = excluded.value,
        flagged = excluded.flagged,
        updated_at = now()
    `;
  }
  return c.json({ ok: true, count: parsed.data.items.length });
});

inspections.get('/:id/responses', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  const responses = (await sql`
    select id, question_key, value, flagged, updated_at
    from inspection_responses
    where inspection_id = ${id}::uuid
    order by question_key asc
  `) as {
    id: string;
    question_key: string;
    value: unknown;
    flagged: boolean;
    updated_at: string;
  }[];
  return c.json({
    responses: responses.map((r) => ({
      id: r.id,
      questionKey: r.question_key,
      value: r.value,
      flagged: r.flagged,
      updatedAt: r.updated_at,
    })),
  });
});

inspections.patch('/:id/responses/:rid/flag', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const rid = c.req.param('rid');
  const parsed = flagBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  const rows = (await sql`
    update inspection_responses
    set flagged = ${parsed.data.flagged}, updated_at = now()
    where id = ${rid}::uuid and inspection_id = ${id}::uuid
    returning id, question_key, value, flagged, updated_at
  `) as {
    id: string;
    question_key: string;
    value: unknown;
    flagged: boolean;
    updated_at: string;
  }[];
  const r = rows[0];
  if (!r) return c.json({ error: 'Response not found' }, 404);
  return c.json({
    id: r.id,
    questionKey: r.question_key,
    value: r.value,
    flagged: r.flagged,
    updatedAt: r.updated_at,
  });
});

inspections.post('/:id/signoff', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = signoffBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  await sql`
    insert into inspection_signoff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(parsed.data.data)}::jsonb)
    on conflict (inspection_id) do update
    set data = excluded.data, updated_at = now()
  `;
  return c.json({ ok: true });
});

inspections.put('/:id/signoff', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = signoffBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  const cur = (await sql`
    select data from inspection_signoff where inspection_id = ${id}::uuid limit 1
  `) as { data: Record<string, unknown> }[];
  const merged = { ...(cur[0]?.data ?? {}), ...parsed.data.data };
  await sql`
    insert into inspection_signoff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(merged)}::jsonb)
    on conflict (inspection_id) do update
    set data = excluded.data, updated_at = now()
  `;
  return c.json({ ok: true });
});

inspections.get('/:id/signoff', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const insp = await getInspection(sql, inspectorId, id);
  if (!insp) return c.json({ error: 'Not found' }, 404);
  const rows = (await sql`
    select data, updated_at from inspection_signoff where inspection_id = ${id}::uuid limit 1
  `) as { data: unknown; updated_at: string }[];
  const row = rows[0];
  if (!row) return c.json({ data: null, updatedAt: null });
  return c.json({ data: row.data, updatedAt: row.updated_at });
});

inspections.get('/:id', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const row = await getInspection(sql, inspectorId, id);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(mapInspection(row));
});

inspections.put('/:id', async (c) => {
  const sql = getSql();
  const inspectorId = c.get('inspectorId');
  const id = c.req.param('id');
  const parsed = updateBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', details: parsed.error.flatten() }, 400);
  }
  const b = parsed.data;
  const cur = await getInspection(sql, inspectorId, id);
  if (!cur) return c.json({ error: 'Not found' }, 404);
  if (b.facilityId !== undefined && b.facilityId !== null) {
    const ok = await assertFacilityOwned(sql, inspectorId, b.facilityId);
    if (!ok) return c.json({ error: 'Facility not found' }, 404);
  }
  const facilityId = b.facilityId !== undefined ? b.facilityId : cur.facility_id;
  const type = b.type ?? cur.type;
  const data =
    b.data !== undefined
      ? { ...(typeof cur.data === 'object' && cur.data !== null ? (cur.data as object) : {}), ...b.data }
      : cur.data;
  const rows = (await sql`
    update inspections
    set
      facility_id = ${facilityId},
      type = ${type},
      data = ${JSON.stringify(data)}::jsonb,
      updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) return c.json({ error: 'Update failed' }, 500);
  return c.json(mapInspection(next));
});
