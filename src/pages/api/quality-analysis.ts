import { NextApiRequest, NextApiResponse } from 'next';
import { runQualityAnalysis } from '~/server/services/qualityAnalysis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { url, task } = req.body;
      if (!url || !task) {
        return res.status(400).json({ error: 'URL and task are required' });
      }
      const result = await runQualityAnalysis(url, task);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'An error occurred during analysis' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}