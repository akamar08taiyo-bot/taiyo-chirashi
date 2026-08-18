export interface Route { name: string; params: Record<string,string>; }
export type RouteHandler = (route: Route) => void | Promise<void>;
let handler: RouteHandler | null = null;

export function parseRoute(): Route {
  const hash = location.hash.replace(/^#\/?/, '');
  const [pathPart=''] = hash.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  if (!parts.length) return { name:'home', params:{} };
  if (parts[0] === 'editor' && parts[1]) return { name:'editor', params:{ id:decodeURIComponent(parts[1]) } };
  return { name:parts[0] ?? 'home', params:{} };
}
export function navigate(path: string): void { location.hash = `#/${path.replace(/^\//,'')}`; }
export function startRouter(next: RouteHandler): void { handler=next; window.addEventListener('hashchange',()=>void handler?.(parseRoute())); void handler(parseRoute()); }
