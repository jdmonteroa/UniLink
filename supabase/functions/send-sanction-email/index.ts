// Edge Function: envía el correo de sanción que la base de datos deja en public.email_outbox.
//
// Cómo se conecta (ver README, "Correos de sanción"):
//   1. Secretos:  supabase secrets set RESEND_API_KEY=... MAIL_FROM="UniLink <avisos@tu-dominio.mx>" WEBHOOK_SECRET=<cadena larga al azar>
//   2. Despliegue: supabase functions deploy send-sanction-email --no-verify-jwt
//   3. Database Webhook sobre INSERT en public.email_outbox → esta función,
//      con el encabezado  x-webhook-secret: <el mismo WEBHOOK_SECRET>.
//
// Usa Resend (https://resend.com). Para otro proveedor solo cambia la función sendMail().
// NOTA: esta función aún no se ha ejecutado contra Resend ni contra un proyecto real.
import { renderTemplate, sanctionSubject, sanctionVars, type SanctionPayload } from './render.ts';

const template = await Deno.readTextFile(new URL('./sancion.html', import.meta.url));

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const MAIL_FROM = Deno.env.get('MAIL_FROM');
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

interface OutboxRow {
  id: string;
  to_email: string;
  template: string;
  payload: SanctionPayload;
  attempts?: number;
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !MAIL_FROM) throw new Error('Falta configurar RESEND_API_KEY y MAIL_FROM.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function markOutbox(id: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/email_outbox?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('No autorizado', { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const row = (body?.record ?? null) as OutboxRow | null;
  if (!row || row.template !== 'sancion') return new Response('Nada que enviar', { status: 200 });

  try {
    const html = renderTemplate(template, sanctionVars(row.payload));
    await sendMail(row.to_email, sanctionSubject(row.payload), html);
    await markOutbox(row.id, { status: 'sent', sent_at: new Date().toISOString(), attempts: (row.attempts ?? 0) + 1, last_error: null });
    return new Response('Enviado', { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markOutbox(row.id, { status: 'failed', attempts: (row.attempts ?? 0) + 1, last_error: message });
    return new Response(message, { status: 500 });
  }
});
