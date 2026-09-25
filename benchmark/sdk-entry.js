// Single bundle entry for the harness page. esbuild resolves the browser build
// of each package, so the page loads one module instead of two.
export { StreamVideoClient } from '@stream-io/video-client';
export { StreamChat } from 'stream-chat';
