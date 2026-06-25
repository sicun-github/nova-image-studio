const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const APP_BASE_PATH = rawBasePath ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}` : '';

export function withBasePath(path: string): string {
  if (!APP_BASE_PATH) return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  if (path.startsWith(APP_BASE_PATH + '/')) return path;
  if (path.startsWith('/')) return `${APP_BASE_PATH}${path}`;
  return `${APP_BASE_PATH}/${path}`;
}
