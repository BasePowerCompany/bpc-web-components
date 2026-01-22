# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BPC Web Components provides custom web components for the marketing website. The main component is `<bpc-address-search>`, an autocomplete address search powered by Google Maps Places API.

## Commands

- `npm run dev` - Start Vite dev server
- `npm run build` - Build production bundle (outputs to `dist/bpc-web-components.js`)
- `npm run lint` - Run Biome linter/formatter check
- `npm run preview` - Preview production build

## Development Setup

Create `.env.development` with your Google Maps API key:
```
VITE_GOOGLE_MAPS_API_KEY=<apiKey>
```

## Architecture

### Web Component Pattern

The project builds a single IIFE bundle (`bpc-web-components.js`) for distribution via jsDelivr CDN. Built files must be committed to the repository.

Entry point: `src/entry.tsx` → registers custom element `<bpc-address-search>`

The custom element (`src/address-search/element.tsx`) wraps React components using Shadow DOM:
- Creates isolated Shadow DOM for styles
- Creates a separate overlay Shadow DOM (appended to document.body) for dropdown portals
- Parses HTML attributes into React props
- Emits `select`, `result`, and `error` custom events

### Key Implementation Details

- **Preact aliasing**: React/ReactDOM imports are aliased to Preact/compat in `vite.config.ts` for smaller bundle size
- **Path alias**: `@/` maps to `src/` directory
- **CSS handling**: Uses CSS modules with `?inline` suffix to embed styles in the bundle
- **Portal pattern**: Autocomplete dropdown uses React portals into the overlay Shadow DOM to escape stacking context issues

### State Management in Web Components

`AddressSearchElement` is a native Web Component (extends `HTMLElement`), not a React component. State like `this.multipleUtilityResult` and `this.selection` are regular class properties with no reactivity.

**Important**: Changing class properties does NOT automatically re-render. You must manually call `this.render()` after state changes:

```typescript
this.multipleUtilityResult = { ... };
this.render();  // Required - React can't see class property changes
```

React is only used inside `render()` via `createRoot().render()` to render JSX into the Shadow DOM. The Web Component owns the state; React just renders it.

### Code Style

- Biome for linting and formatting
- Tab indentation, double quotes for strings
- TypeScript with strict mode
