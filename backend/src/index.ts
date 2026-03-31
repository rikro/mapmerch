import express from 'express';
import cors from 'cors';
import { artworkRouter } from './routes/artwork.js';
import { paymentsRouter } from './routes/payments.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';
import { clearExpiredDrafts } from './services/draftStore.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/artwork', artworkRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

setInterval(clearExpiredDrafts, 60 * 60 * 1000);

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
