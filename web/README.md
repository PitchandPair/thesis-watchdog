# Sift · Frontend

Next.js app for the Sift stock scorecard. Deploys to Vercel with zero config.

- Stock cards with aggregate Sift score, price, Buffett value gap, section bars
- Click a card for full breakdown (weights, moat, competitors, congress trades, feedback, trend odds)
- Add / remove stocks (saved in the browser)
- Select stocks → Create AI summary podcast (3 ElevenLabs voices)

## Run
npm install && npm run dev

## Deploy
Import to Vercel. Set `ELEVENLABS_API_KEY` in env vars for audio.

## Data
`lib/data.ts` holds sample data. Next step: read the Google Sheet end-results tab.
Information only. Not investment advice.
