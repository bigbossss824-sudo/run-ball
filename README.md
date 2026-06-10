# Run Ball Web

This is a static browser version of the Run Ball game. Open `index.html` through a local web server, or deploy the folder to GitHub Pages, Netlify, or Vercel.

Public version:

```text
https://run-ball.netlify.app
```

For testing by double-clicking a file, open `play.html`. It embeds the game code directly so the browser does not block the local JavaScript module.

Quick local run:

```powershell
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

The current build uses Three.js from a CDN, so the published site needs internet access.
