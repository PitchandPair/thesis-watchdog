# Sift web

Next.js 16 dashboard for Sift. See the "Web frontend" section of the root README for features and settings.

- `app/page.tsx`: dashboard, detail view, click-for-source panel, Ask Sift, PRISM checks, Survey tab, podcast
- `app/api/ai`: Ask Sift (Nicrron, level picks the model, traced to PRISM)
- `app/api/ask`: proxy to the analyst (`/api/chat`)
- `app/api/survey`: proxy to the simulated survey (`/api/survey`)
- `app/api/podcast`: ElevenLabs text to speech
- `lib/data.ts`: Sheet snapshot with a source for every value
- `lib/prism.ts`: PRISM test results

To refresh the data, update `lib/data.ts` from the Sheet (Results, Buffett, Moat + Competitors, Company Feedback, Congress Summary, News Sentiment tabs).

Information only. Not investment advice.
