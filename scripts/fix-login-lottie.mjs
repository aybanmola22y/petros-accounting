import fs from "fs";
import https from "https";

const url = "https://assets10.lottiefiles.com/packages/lf20_jcikwtux.json";
const out = "d:/accounting/public/lottie/login-hero.json";

https
  .get(url, (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
      const data = JSON.parse(raw);

      // Hide decorative floating bars — their isometric paths cut through the tablet.
      for (const layer of data.layers) {
        if (/bar/i.test(layer.nm)) {
          layer.hd = true;
        }
      }

      const keepFront = [
        "boy",
        "boy shadow",
        "girl",
        "girl shadow",
        "screen 1",
        "screen 2",
        "screen 3",
        "screen",
        "Shape Layer 2",
        "mobile",
      ];

      const front = [];
      const bars = [];
      const rest = [];

      for (const layer of data.layers) {
        if (keepFront.includes(layer.nm)) front.push(layer);
        else if (/bar/i.test(layer.nm)) bars.push(layer);
        else rest.push(layer);
      }

      front.sort(
        (a, b) => keepFront.indexOf(a.nm) - keepFront.indexOf(b.nm),
      );

      // Keep bars at the back as well (hidden) so z-order stays correct if re-enabled.
      data.layers = [...front, ...rest, ...bars];

      fs.writeFileSync(out, JSON.stringify(data));
      console.log(data.layers.map((l, i) => `${i} ${l.nm}${l.hd ? " [hidden]" : ""}`).join("\n"));
      console.log("wrote", out, fs.statSync(out).size);
    });
  })
  .on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
