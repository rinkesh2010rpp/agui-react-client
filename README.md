# agilab

Headless React primitives for building agentic UIs on the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui). No runtime required — connects your React app directly to any AG-UI agent.

## Packages

| Package | Version | Description |
|---|---|---|
| [`@agilab/react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@agilab/react)](https://www.npmjs.com/package/@agilab/react) | Headless hooks — converts AG-UI SSE events into streaming-aware React state |
| [`@agilab/emulator`](./packages/emulator) | coming soon | Local AG-UI emulator for testing your UI without a real agent |

## Quick start

```bash
npm install @agilab/react
```

The library connects your React app to any [AG-UI compatible backend](https://github.com/ag-ui-protocol/ag-ui). To try it without a real agent, `@agilab/emulator` is coming soon.

See [`packages/react`](./packages/react) for full documentation.

## Development

```bash
npm install          # install all workspaces
npm run dev          # start the example app
npm run build        # build all packages
npm run typecheck    # typecheck all packages
npm run test         # test all packages
```

## License

MIT
