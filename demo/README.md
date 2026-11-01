# Demo video

`foodgo-demo.mp4` (about 2 minutes, captioned, no audio) walks through the full pre-order scenario across all four roles:

FoodGO serves only Lac 3 and Zone Industrielle Le Kram (ADR-0007); the demo data lives there.

1. Customer signs in with an SMS code, sees only her restaurants with their zones, is refused after a deadline, orders before another, pays cash on delivery.
2. Restaurant staff see the order live, start preparing, assign their own delivery person, read the AI prep forecast, edit the menu, register a customer in person at a workplace in one of the two zones.
3. The delivery person sees only their assignment, starts and confirms the delivery with cash collected.
4. The customer's order shows delivered and paid, live.
5. The administrator's monitoring and audit trail, restaurants with their zones, then the OpenAPI documentation.

## Re-record

```bash
npm run seed && npm start          # terminal 1, fresh demo data
npm run demo                       # terminal 2, writes demo/foodgo-demo.mp4
```

Requires Playwright with Chromium and ffmpeg (dev tools only, not needed to run the app). `DEMO_URL` overrides the default `http://localhost:3000`.
