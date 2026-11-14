/** Shared open/closed state for the mobile admin nav drawer — read/toggled from both `AdminTopbar` (the hamburger button) and `AdminMobileNav` (the slideover itself). */
export function useAdminMobileNav() {
  return useState('admin-mobile-nav-open', () => false)
}
