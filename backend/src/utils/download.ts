import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function downloadToFile(
  url: string,
  filePath: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const response = await axios.get(url, { responseType: 'stream' });
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve());
    writer.on('error', err => reject(err));
  });
}
