export type NavItem = {
  label: string;
  href: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type MenuConfig = {
  title: string;
  groups?: NavGroup[];
  items?: NavItem[];
};
