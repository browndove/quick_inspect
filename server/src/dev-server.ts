/**
 * Local development — `node` listens on PORT. Vercel uses `src/index.ts`.
 */
import 'dotenv/config';
import { app } from './http-app.js';

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST ?? '0.0.0.0';

app.listen(port, hostname, () => {
  console.log(`Listening on http://${hostname}:${port}`);
  console.log(
    `From a phone: http://<this-machine-LAN-IP>:${port} (same Wi‑Fi; matches EXPO_PUBLIC_API_URL)`,
  );
});
