# Pips & Petals

A five-dice game built with the Next.js App Router. Play thirteen scoring categories on your own, against Player 2, the computer opponent, or share the device with two to four local players.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to play solo. Use **New game** to choose **1 player · no opponent**, a computer opponent, or two, three, or four local players. Solo turns continue immediately after scoring, and the game shows your final score after all thirteen categories are filled. Open <http://localhost:3000/pass-and-play> to start a four-player local game directly. Multiplayer local turns pause until the next player taps **Ready**. Use **How to play** in the header for the turn rules and scoring overview.

Scoring suggestions and the computer favor three matching dice in Ones through Sixes over Three of a kind, Four of a kind, and Chance while the 63-point bonus is still reachable. Extra matches help recover earlier shortfalls; earlier extras also count toward the target. A completed Full house ranks above a top-section triple, and the computer keeps the full hand. Bonus chasing ends once the bonus is earned or is no longer reachable. Chance stays in the third suggestion slot while available, moving to the first slot when the other choices all score zero.

Your first **Five of a kind** automatically scores 50 and ends the turn. Each additional five of a kind automatically adds +100, and bonuses keep accumulating. The game also scores the matching upper category if it is open. If that box is filled, tap **Choose a category** on the celebration, then choose an open lower category on the scorecard using joker scoring (Full house: 25, Small straight: 30, Large straight: 40; other lower categories: dice total). The bonus is already added, and you cannot reroll while choosing. If the lower section is full, the game automatically fills an open upper category. The computer chooses its own category. Scoring zero in Five of a kind disables repeat bonuses.

In development (`npm run dev`), open **Dev mode** below the dice controls to change **Dice surface** live (default: `#ffffff`). Dark colors automatically use white pips; lighter colors use dark pips. Adjust **Shadow darkness** from 0–100% (starting at 25%) to lighten or darken the shaded sides independently of the surface color. Both controls apply to all dice, including celebrations, for the current page session. **Reset dice appearance** restores the original color and shadows. Use **Roll five of a kind** to test the automatic score and celebration. It releases held dice and rolls five matching faces using the normal animation. The roll button is unavailable during computer turns, handoffs, and rolls. Dev controls are omitted from production builds.

Open <http://localhost:3000/dice-prototype> for the enlarged 3D die preview. Roll a random result or use the six face buttons to inspect each landing. The Three.js model has rounded edges, concave pip meshes, a white physical material, environment reflections, and real lighting. The dice sit on a darker gray tray without cast shadows. Move the light slider to inspect the curved edges. Use **Dice appearance** to compare **Original 3D** and **Lighter 3D**. Adjust **Frame rate limit** from 10 to 60 FPS (starting at 30) to compare smoothness and rendering load, including during a roll. This is a cap, so slower devices may render fewer frames; the roll duration and landing stay the same. The cap applies only to the prototype. The same models and rolling animation run in the game; held dice stay still on rerolls. Reduced-motion preferences skip the animation.

A loading spinner stays visible until all five dice renderers have drawn their pip and blank appearances, the selected flower background has downloaded and decoded, and the page fonts are ready. Roll controls become available only after preparation. New backgrounds are also prepared when starting another game; an image loading failure offers **Try again**.

Each new game (including **Play again**) randomly selects one of 30 floral backgrounds and its matching interface palette, without repeating the previous theme. The theme stays fixed throughout the game. Optimized WebP versions of the original images in `public/bgs` keep all 30 backgrounds to about 2.1 MB combined; the offline installer caches them all. Backgrounds and accent colors are listed in `public/bgs/themes.json`.

The game fits a 1024×768 frame: a floral watercolor dice tray on the left, the scorecard on the right, and three live scoring suggestions below the dice. Tap a suggestion or use **Choose another score** to see every open category. The scorecard shows only committed scores; open categories stay as dashes until selected. The active player’s column stays highlighted. Below 700px, the scorecard opens in a popup from the **Scorecard** button at the bottom of the game, keeping the game compact. Modern devices keep the original WebGL 2 dice. iOS/Safari 15 and older use a separate WebGL 1 renderer with the same shape, recessed pip meshes, material, lighting, and animation, but fewer polygons, smaller textures, a lower pixel ratio, and one combined pip mesh to reduce draw calls. Touch input alone does not reduce quality. If the original renderer fails or loses its context, the game switches to the lighter renderer; if WebGL is unavailable, six CSS faces still roll in 3D perspective. All renderers are included in the cached game bundle for offline play.

Safari/iPadOS 15.4 is the configured build target. Rendering and compatibility checks on a modern browser do not replace performance testing on a physical iPad Air 2.

Both 3D renderers batch all 21 recessed pips into one indexed mesh per die, preserving the original pocket shapes and normals. This reduces the full renderer's pip draw calls from 21 to one and the lighter renderer's pip buffer memory by about 72%. Camera, color, and canvas size updates are skipped when unchanged. Background tabs pause animation rendering and resume at the correct elapsed roll position. These changes preserve the existing resolution, lighting, frame-rate limits, and roll timing; device FPS still needs to be measured on hardware.

The WebGL 1 renderer imports r162 source modules through `app/lib/three-legacy/index.mjs` to keep its engine private alongside modern Three.js. Its two MIT-licensed addons are copied from r162 with imports pointing to that same private engine; keep them aligned with `three-legacy` when updating it.

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
4. Open **Pips & Petals** from the Home Screen once while online, then it can launch and play offline.

The installed app opens without Safari's toolbar, with a dice icon. Solo, computer, and two-to-four-player games work offline after setup; the separate 3D dice prototype is not precached. Scores last for the current session and reset if the app reloads. Before deploying a new build, bump `CACHE_NAME` in `public/sw.js` so installed apps download the new complete offline shell.
