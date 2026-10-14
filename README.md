# Petals & Pips

A five-dice game built with the Next.js App Router. Play thirteen scoring categories against Player 2, the computer opponent, or share the device with two to four local players.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to play against the computer. Use **New game** to choose a computer opponent or two, three, or four local players. Open <http://localhost:3000/pass-and-play> to start a four-player local game directly. Local turns pause until the next player taps **Ready**. Use **How to play** in the header for the turn rules and scoring overview.

Score 50 in **Five of a kind** to unlock repeat bonuses. Each additional five of a kind earns +100 when you score the turn in an open category, and bonuses keep accumulating. Use the matching upper category if it is open; otherwise choose an open lower category with joker scoring, or any open upper category if the lower section is full. The bonus row shows the accumulated points and a **+100 ready** preview for a qualifying roll.

Open <http://localhost:3000/dice-prototype> for the enlarged 3D die preview. Roll a random result or use the six face buttons to inspect each landing. The Three.js model has rounded edges, concave pip meshes, an ivory physical material, environment reflections, and real lighting and cast shadows. Move the light slider to inspect the curved edges. The same model and rolling animation run in the game; held dice stay still on rerolls. Reduced-motion preferences skip the animation.

On tablet screens, the dice and scorecard sit side by side. The scorecard scrolls independently with pinned totals. Both touch and desktop devices use the animated 3D dice; flat pip dice appear only if WebGL cannot initialize.

## Install on an iPad Air 2

Update the iPad to the latest iPadOS 15 update available in **Settings → General → Software Update**. The game explicitly targets Safari/iPadOS 15.4 and newer, including the iPad Air 2, instead of Next.js's default Safari 16.4 target.

Serve a production build over **HTTPS**:

```bash
npm run build
npm start
```

Use an HTTPS host or HTTPS reverse proxy in front of the server. Opening an HTTP LAN address (such as `http://192.168.1.10:3000`) on the iPad does not enable service workers or offline play. The development server does not register the offline worker.

1. Open the game's HTTPS URL in **Safari** on the iPad.
2. Tap **Install** in the game for instructions. Wait until it says **Ready for offline play**.
3. Tap Safari's **Share** button → **Add to Home Screen** → **Add**.
4. Open **Petals & Pips** from the Home Screen once while online, then it can launch and play offline.

The installed app opens without Safari's toolbar, with a dice icon. Computer games and two-to-four-player games work offline after setup; the separate 3D dice prototype is not precached. Scores last for the current session and reset if the app reloads. Before deploying a new build, bump `CACHE_NAME` in `public/sw.js` so installed apps download the new complete offline shell.
