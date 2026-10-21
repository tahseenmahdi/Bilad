export const serviceCategories = [
  { id: 'taxi', label: 'Taxi' },
  { id: 'order', label: 'Order' },
  { id: 'internet', label: 'Internet' },
] as const;

export type ServiceCategory = typeof serviceCategories[number]['id'];

export const serviceAsset = (file: string) => `/assets/iraqi-service-app-assets/assets/${file}.jpg`;

export const serviceApps: {
  id: string;
  name: string;
  categories: ServiceCategory[];
  brief: string;
  href: string;
}[] = [
  { id: 'baly', name: 'Baly', categories: ['taxi', 'order'], brief: 'Book a taxi or order food in one app.', href: 'https://baly.iq/' },
  { id: 'careem', name: 'Careem', categories: ['taxi'], brief: 'Book a ride and get around the city.', href: 'https://www.careem.com/' },
  { id: 'toters', name: 'Toters', categories: ['order'], brief: 'Order from restaurants, grocery stores, and local shops.', href: 'https://www.totersapp.com/' },
  { id: 'lezzoo', name: 'Lezzoo', categories: ['order'], brief: 'Food, groceries, and everyday essentials, delivered.', href: 'https://www.lezzoo.com/' },
  { id: 'talabat', name: 'Talabat', categories: ['order'], brief: 'Browse restaurants and order food to your door.', href: 'https://iraq.talabat.com/' },
  { id: 'miswag', name: 'Miswag', categories: ['order'], brief: 'Shop online for electronics, fashion, and more.', href: 'https://miswag.com/en' },
  { id: 'asiacell', name: 'Asiacell', categories: ['internet'], brief: 'Manage your line, top up, and choose mobile data packages.', href: 'https://www.asiacell.com/en/personal' },
  { id: 'zain-iraq', name: 'Zain Iraq', categories: ['internet'], brief: 'Top up your balance and manage internet offers.', href: 'https://www.iq.zain.com/en/services/mobile-app' },
];
