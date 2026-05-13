export interface CategoryInfo {
  icon: string;
  bg: string;
  color: string;
}

const RULES: Array<{ keywords: string[]; info: CategoryInfo }> = [
  {
    keywords: [
      'dinner', 'lunch', 'breakfast', 'food', 'pizza', 'burger', 'restaurant',
      'cafe', 'coffee', 'sushi', 'grocery', 'groceries', 'meal', 'eat',
      'brunch', 'takeout', 'takeaway', 'donut', 'bakery', 'sandwich', 'taco',
      'curry', 'noodle', 'ramen', 'pasta', 'kebab', 'bbq', 'snack', 'dessert',
      'ice cream', 'boba', 'smoothie', 'juice', 'tea',
    ],
    info: { icon: 'restaurant-outline', bg: 'rgba(255,149,0,0.15)', color: '#FF9500' },
  },
  {
    keywords: [
      'beer', 'wine', 'cocktail', 'bar', 'pub', 'drink', 'alcohol', 'whiskey',
      'vodka', 'gin', 'shots', 'nightclub', 'club',
    ],
    info: { icon: 'beer-outline', bg: 'rgba(255,149,0,0.15)', color: '#FF9500' },
  },
  {
    keywords: [
      'flight', 'plane', 'airport', 'hotel', 'airbnb', 'hostel', 'vacation',
      'trip', 'holiday', 'travel', 'booking', 'resort', 'motel', 'cruise',
    ],
    info: { icon: 'airplane-outline', bg: 'rgba(50,173,230,0.15)', color: '#32ADE6' },
  },
  {
    keywords: [
      'uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'subway', 'tram',
      'gas', 'fuel', 'petrol', 'parking', 'toll', 'ride', 'transit', 'car',
      'bike', 'scooter', 'transport',
    ],
    info: { icon: 'car-outline', bg: 'rgba(10,132,255,0.15)', color: '#0A84FF' },
  },
  {
    keywords: [
      'shop', 'shopping', 'amazon', 'mall', 'market', 'store', 'clothing',
      'clothes', 'shoes', 'fashion', 'retail', 'ikea', 'walmart', 'target',
      'costco', 'zara', 'h&m', 'uniqlo', 'primark',
    ],
    info: { icon: 'bag-handle-outline', bg: 'rgba(255,55,95,0.15)', color: '#FF375F' },
  },
  {
    keywords: [
      'rent', 'mortgage', 'electricity', 'electric', 'water', 'internet',
      'wifi', 'cable', 'utility', 'utilities', 'bill', 'bills', 'lease',
      'heating', 'cooling', 'ac', 'broadband', 'phone bill', 'council',
    ],
    info: { icon: 'home-outline', bg: 'rgba(94,92,230,0.15)', color: '#5E5CE6' },
  },
  {
    keywords: [
      'netflix', 'spotify', 'movie', 'cinema', 'film', 'concert', 'show',
      'theater', 'theatre', 'gaming', 'streaming', 'hulu', 'disney', 'music',
      'event', 'gig', 'festival', 'ticket', 'youtube', 'twitch', 'apple tv',
    ],
    info: { icon: 'film-outline', bg: 'rgba(255,59,48,0.15)', color: '#FF3B30' },
  },
  {
    keywords: [
      'gym', 'fitness', 'doctor', 'hospital', 'pharmacy', 'medicine',
      'medical', 'dental', 'health', 'workout', 'yoga', 'clinic', 'physio',
      'optician', 'prescription', 'therapy',
    ],
    info: { icon: 'fitness-outline', bg: 'rgba(48,209,88,0.15)', color: '#30D158' },
  },
  {
    keywords: [
      'phone', 'apple', 'google', 'software', 'app', 'subscription', 'tech',
      'gadget', 'laptop', 'computer', 'icloud', 'microsoft', 'iphone',
      'android', 'ipad', 'device',
    ],
    info: { icon: 'phone-portrait-outline', bg: 'rgba(10,132,255,0.15)', color: '#0A84FF' },
  },
  {
    keywords: [
      'book', 'course', 'class', 'school', 'university', 'tuition',
      'education', 'study', 'learning', 'textbook', 'stationery', 'supplies',
    ],
    info: { icon: 'book-outline', bg: 'rgba(255,214,10,0.2)', color: '#CC9900' },
  },
  {
    keywords: ['pet', 'dog', 'cat', 'vet', 'animal', 'grooming', 'kennel'],
    info: { icon: 'paw-outline', bg: 'rgba(255,149,0,0.15)', color: '#FF9500' },
  },
  {
    keywords: [
      'haircut', 'salon', 'spa', 'beauty', 'nails', 'manicure', 'pedicure',
      'massage', 'barber', 'wax',
    ],
    info: { icon: 'cut-outline', bg: 'rgba(191,90,242,0.15)', color: '#BF5AF2' },
  },
  {
    keywords: ['gift', 'present', 'birthday', 'celebration', 'anniversary', 'wedding'],
    info: { icon: 'gift-outline', bg: 'rgba(255,55,95,0.15)', color: '#FF375F' },
  },
  {
    keywords: [
      'sport', 'football', 'basketball', 'soccer', 'tennis', 'golf',
      'swimming', 'cricket', 'rugby', 'volleyball', 'badminton', 'squash',
      'cycling', 'running', 'marathon', 'bowling', 'archery',
    ],
    info: { icon: 'football-outline', bg: 'rgba(48,209,88,0.15)', color: '#30D158' },
  },
];

const DEFAULT: CategoryInfo = {
  icon: 'receipt-outline',
  bg: 'rgba(94,92,230,0.15)',
  color: '#5E5CE6',
};

export function getExpenseCategory(description: string): CategoryInfo {
  const lower = description.toLowerCase();
  for (const { keywords, info } of RULES) {
    if (keywords.some(kw => lower.includes(kw))) {
      return info;
    }
  }
  return DEFAULT;
}
