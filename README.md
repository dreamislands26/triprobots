# TRIPROBOTS

Corporate landing for **TRIPROBOTS — AI & Robotics for Business Operations**.

## Deploy to Cloudflare Pages

Use the repository root as the site source.

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `/`

Then connect the custom domains:

- `triprobots.ru`
- `www.triprobots.ru`

The site is static and does not require a server-side runtime.

## Solutions and palette update

- Edit public scenarios, prices, defaults and lead times in `data/solutions.json`; internal delivery economics are not published.
- Share `/#solutions-logistika`, `/#solutions-distribuciya`, `/#solutions-proizvodstvo`, `/#solutions-riteil`, `/#solutions-servis`, `/#solutions-malyi-biznes`. Browser Back/Forward restores the selected filter.
- Theme tokens are in `assets/palette.css`. Legacy CSS uses these tokens; standalone SVG branding embeds the matching colors.
- The static contact form opens a mail client. With a file it downloads an unsent MIME email draft with the attachment. The visitor must open and send it; no server-side upload or automatic lead submission is configured.
- Run regression checks with `node --test tests/solutions.test.cjs`.
- Before merging, review copy/prices and check the homepage plus detail pages at 375 px in light/dark themes. Browser QA could not run in the authoring environment because its preview daemon was unavailable.
