import {Hono} from 'hono';
import {db} from '../db/store.js';
import {requireAuth, requirePlatformAdmin} from '../middleware/auth.middleware.js';
import {getWebhookRepository} from '../repositories/webhook.repository.js';

export const adminRoute = new Hono();

// Enforce Platform Administrator Authentication & Authorization (P0-05)
adminRoute.use('/admin/*', requireAuth, requirePlatformAdmin);

// GET /api/admin/metrics
adminRoute.get('/admin/metrics', (c) => {
  return c.json({
    success: true,
    data: {
      mrr: 142500000,
      arr: 1710000000,
      activeTenantsCount: 29,
      monthlyGrowthRate: 0.16,
      churnRate: 0.012,
      systemHealth: {
        apiStatus: 'HEALTHY',
        webhookLatencyMs: 210,
        gatewayStatus: 'CONNECTED'
      },
      tenants: [
        {name: 'PT Ruang Karya Konstruksi', plan: 'Core', quota: '3/3', mrr: 4900000, status: 'Active'},
        {name: 'PT Wijaya Karya Spesialis', plan: 'Scale', quota: '7/10', mrr: 9900000, status: 'Active'},
        {name: 'PT Bangun Megah Nusantara', plan: 'Paid Pilot', quota: '1/1', mrr: 7500000, status: 'Pilot Day 32'},
        {name: 'PT Cipta Sarana Mandiri', plan: 'Core', quota: '2/3', mrr: 4900000, status: 'Active'}
      ]
    }
  });
});

// GET /api/admin/webhooks
adminRoute.get('/admin/webhooks', async (c) => {
  const webhookRepo = getWebhookRepository();
  const repoEvents = await webhookRepo.getRecentWebhookEvents(100).catch(() => []);
  const events = repoEvents && repoEvents.length > 0 ? repoEvents : db.webhooks;
  return c.json({
    success: true,
    data: events
  });
});

// GET /api/admin/recovery/leads
adminRoute.get('/admin/recovery/leads', (c) => {
  return c.json({
    success: true,
    data: {
      abandonRate: 0.245,
      recoveryRate: 0.628,
      complianceNote: 'Chatbot WhatsApp otomatis berstatus LATER (Phase 20F). Pengiriman saat ini bersifat manual oleh staf sales berizin via template resmi.',
      leads: db.recoveryLeads
    }
  });
});

// POST /api/admin/recovery/template
adminRoute.post('/admin/recovery/template', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const leadId = body.leadId;
  const lead = db.recoveryLeads.find(l => l.id === leadId);
  if (!lead) {
    return c.json({success: false, error: 'Prospek tidak ditemukan'}, 404);
  }

  if (lead.consentStatus !== 'GRANTED') {
    return c.json({success: false, error: 'Dilarang menghubungi: tidak ada consent atau status suppressed.'}, 403);
  }

  lead.contacted = true;
  db.save();
  const messageText = `Halo Pak/Ibu ${lead.name}, kami dari tim layanan COVE. Kami melihat Anda memilih paket ${lead.plan} untuk ${lead.company}, namun proses checkout belum terselesaikan. Apakah ada kendala verifikasi pembayaran atau hal yang bisa kami bantu jelaskan? (Balas STOP jika tidak berkenan menerima pesan ini).`;
  const clickToChatUrl = `https://wa.me/${lead.phoneClean}?text=${encodeURIComponent(messageText)}`;

  return c.json({
    success: true,
    data: {
      leadId: lead.id,
      phone: lead.phone,
      messageText,
      clickToChatUrl,
      mode: 'MANUAL_CLICK_TO_CHAT',
      isAutomatedBot: false,
      phase: 'CURRENT_MANUAL_AUTHORIZED'
    }
  });
});

// PATCH /api/admin/features/:id
adminRoute.patch('/admin/features/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const feature = db.features.find(f => f.id === id);
  if (!feature) {
    return c.json({success: false, error: 'Usulan fitur tidak ditemukan.'}, 404);
  }

  if (body.status) feature.status = body.status;
  if (body.update) feature.update = body.update;
  db.save();

  return c.json({success: true, data: feature});
});
