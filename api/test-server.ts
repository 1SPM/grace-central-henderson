/**
 * Simple test server for AI endpoint
 */
import express from 'express';
import cors from 'cors';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mount AI routes
app.use('/api/ai', aiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    gemini: !!process.env.GEMINI_API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`AI endpoint: http://localhost:${PORT}/api/ai/generate`);
  console.log(`Gemini configured: ${!!process.env.GEMINI_API_KEY}`);
});
