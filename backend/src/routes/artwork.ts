import { Router, Request, Response } from 'express';
import { fetchStreetGeometry, fetchWaterGeometry } from '../services/geometryService.js';
import { fetchLandGeometry } from '../data/landData.js';
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
    const { highwayTypes, labelOffset, groupMap } = req.body as GenerateArtworkRequest;

    const [streetData, waterRings] = await Promise.all([
      fetchStreetGeometry(polygon),
      fetchWaterGeometry(polygon),
    ]);

    // fetchLandGeometry is synchronous — no need to include in Promise.all
    const landRings = fetchLandGeometry(polygon);

    const filtered = highwayTypes?.length
      ? { ...streetData, features: streetData.features.filter(f => highwayTypes.includes(f.properties['highway'] as string)) }
      : streetData;

    if (filtered.features.length === 0) {
      return res.status(400).json({ error: 'No streets of the selected types found in this area. Try enabling more street types.' });
    }

    const svg = generateSvg(filtered, style, labelOffset, groupMap ?? {}, waterRings, landRings, polygon);
    const draft = saveDraft(sessionToken, polygon, style, svg);
    const response: GenerateArtworkResponse = { draftId: draft.id, svg };
    return res.json(response);
  } catch (err) {
    console.error('Artwork generation error:', err);
    return res.status(500).json({ error: 'Artwork generation failed. Please try again.' });
  }
});
