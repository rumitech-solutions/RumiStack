# RumiStack 1.2.0

## Smarter first-run setup

The Setup Wizard now prefers a coding assistant already detected on the current laptop when the portable profile does not already specify a primary assistant. A previously selected assistant always takes precedence.

FreeLLMAPI and OmniRoute choices now indicate when a saved local provider profile exists. Selecting one lets you review and reuse its saved URL, model and environment-variable name.

## Safety

- Detection checks only whether supported assistant commands are available on PATH.
- The wizard does not install, launch, sign in to, or modify assistants or gateways automatically.
- Provider secrets and login sessions are not read or copied.
- Saving remains an explicit user action.
