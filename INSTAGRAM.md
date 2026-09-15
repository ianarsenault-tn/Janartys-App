# Instagram Graph API (planned)

Today: staff paste image URL / caption / permalink in Manager → stored on `shop/live.instagram`.

## To go automatic

1. Meta Developer app linked to the Janarty’s Facebook Page / Instagram professional account (@janartys).
2. Instagram Graph API permissions (typically `instagram_basic`, `pages_show_list`, and media read as required by Meta’s current product).
3. OAuth once to get a Page/IG user token; store refresh/long-lived token in a Cloud Function secret (not in the web app).
4. Scheduled or on-demand Function writes the latest media URL + caption into `shop/live.instagram` (staff Auth or admin-only write path).
5. Keep staff paste as a manual override.

Until that ships, paste remains correct and zero-cost.
