/** Vite's `?raw` suffix returns a module's file contents as a string. The build
 *  understands it; tsc does not, because tsconfig pins `types` to bun and never
 *  pulls in vite/client. Declared narrowly rather than referencing the whole of
 *  vite/client, which would drag in DOM and env typings this project does not
 *  otherwise use. */
declare module "*?raw" {
  const content: string;
  export default content;
}
