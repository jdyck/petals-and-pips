# Lucky Five

A one-player Yahtzee-style dice game built with the Next.js App Router. Play thirteen scoring categories against Milo, the computer opponent.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to play. Use **How to play** in the header for the turn rules and scoring overview.

Open <http://localhost:3000/dice-prototype> for the enlarged 3D die preview. Roll a random result or use the six face buttons to inspect each landing. The Three.js model has rounded edges, concave pip meshes, an ivory physical material, environment reflections, and real lighting and cast shadows. Move the light slider to inspect the curved edges. The same model and rolling animation run in the game; held dice stay still on rerolls. Reduced-motion preferences skip the animation.
