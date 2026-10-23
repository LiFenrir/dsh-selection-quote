/**
 * Host half of the bundle. The plugin is client-only, so there is nothing to
 * register on the server side; the export keeps the bundle's `main` entry valid.
 */
export function apply(): void {}
