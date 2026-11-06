// Preloaded for the `*.dom.test.tsx` files only (see the root `test` script): one DOM for the whole run,
// because Testing Library keeps the window it first meets. The server-rendering tests run in a separate
// process with no browser globals at all, which is what proves they render on a server.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A real page has an origin, which forms resolve their actions against.
GlobalRegistrator.register({ url: "http://localhost:3000/" });
// React's act() warnings ask for this flag.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Each file cleans up after its own tests; Testing Library's automatic hooks cannot be added from a preload.
process.env["RTL_SKIP_AUTO_CLEANUP"] = "true";
