import { Router, Request, Response } from 'express';
import { fetchStreetGeometry } from '../services/geometryService.js';
import { generateSvg } from '../services/artEngine.js';
import { saveDraft } from '../services/draftStore.js';
import { GenerateArtworkRequest, GenerateArtworkResponse } from '../types.js';

export const artworkRouter = Router();

artworkRouter.post('/generate', async (req: Request, res: Response) => {
  const { polygon, style, sessionToken } = req.body as GenerateArtworkRequest;

  if (!polygon || !style || !sessionToken) {
    return res.status(400).json({ error: 'polygon, style, and sessionToken are required' });
  }

  try {
    const streetData = await fetchStreetGeometry(polygon);
    const svg = generateSvg(streetData, style);
    const draft = saveDraft(sessionToken, polygon, style, svg);
    const response: GenerateArtworkResponse = { draftId: draft.id, svg };
    return res.json(response);
  } catch (err) {
    console.error('Artwork generation error:', err);
    return res.status(500).json({ error: 'Artwork generation failed. Please try again.' });
  }
});
