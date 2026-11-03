# Contributing

- Keep the control-plane repository small; do not commit cloned third-party source trees or project repositories.
- Prefer official upstream links and check current license / install instructions.
- Do not add secrets, API keys, tokens or personal information.
- Update the date in `registry/tools.json` when changing the catalogue.
- Run `npm run check` before submitting changes.
- Keep dashboard actions allow-listed; never add a generic shell or arbitrary URL execution endpoint.