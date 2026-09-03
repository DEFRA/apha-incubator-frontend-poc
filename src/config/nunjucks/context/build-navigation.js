export function buildNavigation(request) {
  return [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    },
    {
      text: 'Latest cases',
      href: '/latest-cases',
      current: request?.path === '/latest-cases'
    }
  ]
}
