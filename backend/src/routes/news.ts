import { Router, Request, Response } from 'express';
const router = Router();

router.get('/today', (req: Request, res: Response) => {
  res.json({ message: 'Hello News (today)!' });
});

export default router;
