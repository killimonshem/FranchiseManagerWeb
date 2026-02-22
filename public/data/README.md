# Static Assets

This directory contains static assets served by Vite during development and build.

## teams_colors_logos.json

Download from: https://github.com/nflverse/nflverse-data/releases/download/manually_updated/teams_colors_logos.json

Place it in this directory to avoid CORS errors and external API calls.

### Why?
- Fixes CORS policy errors on GitHub-hosted external data
- Reduces external dependencies for offline/development use
- Enables local development without network access
- Improves load time by serving from local build

### Format
Array of NFL team objects with:
- `team_abbr`: Team abbreviation (e.g., "DAL")
- `team_name`: Full team name
- `team_logo_url`: Logo image URL
- `team_color`: Primary brand color
- `team_color2`: Secondary brand color

The application gracefully falls back to GitHub if this file is missing.
