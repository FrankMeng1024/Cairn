/** Mock data for all screens */

export const MOCK_FRIENDS = [
  { id: '1', name: 'Sam', initials: 'S', online: true, lastSeen: '刚刚', sharedMarkers: 12 },
  { id: '2', name: 'Mika', initials: 'M', online: false, lastSeen: '3小时前', sharedMarkers: 7 },
  { id: '3', name: 'Yuki', initials: 'Y', online: false, lastSeen: '昨天', sharedMarkers: 3 },
];

export const MOCK_ROUTES = [
  { id: '1', name: 'Tongariro Alpine Crossing', date: '2026-05-12', distanceKm: 19.4, durationMin: 387, markerCount: 5 },
  { id: '2', name: 'Kepler Track Day 1', date: '2026-05-03', distanceKm: 14.6, durationMin: 280, markerCount: 3 },
  { id: '3', name: 'Routeburn Flats', date: '2026-04-28', distanceKm: 8.1, durationMin: 142, markerCount: 1 },
];

export type MarkerType = 'danger' | 'scenic' | 'supply' | 'junction' | 'free';

export const MARKER_META: Record<MarkerType, { label: string; icon: string; iconName: string; color: string; bg: string }> = {
  danger:   { label: '危险',   icon: '!',  iconName: 'TriangleAlert', color: '#c53d2e', bg: '#f4e0dc' },
  scenic:   { label: '风景',   icon: '★',  iconName: 'Star',          color: '#2e6cc5', bg: '#dce8f4' },
  supply:   { label: '补给',   icon: '+',  iconName: 'Droplets',      color: '#2e8c3a', bg: '#dcf4de' },
  junction: { label: '路口',   icon: '→',  iconName: 'Navigation2',   color: '#b36b00', bg: '#fff3e0' },
  free:     { label: '自由',   icon: '○',  iconName: 'MapPin',        color: '#8c7e72', bg: '#ffffff' },
};

export const MOCK_MARKERS = [
  {
    id: '1', type: 'danger' as MarkerType,
    text: '路面湿滑，注意脚下', author: 'Sam', minutesAgo: 45, x: 0.3, y: 0.4,
    title: '安全警告', note: '路面湿滑，注意脚下，建议放慢速度', distanceM: 340, timeAgo: '45分钟前',
  },
  {
    id: '2', type: 'scenic' as MarkerType,
    text: '绝美火山口，值得停留', author: 'Mika', minutesAgo: 120, x: 0.6, y: 0.35,
    title: '景观点', note: '绝美火山口全景，值得停留拍照', distanceM: 1200, timeAgo: '2小时前',
  },
  {
    id: '3', type: 'supply' as MarkerType,
    text: '干净水源，可直接饮用', author: 'Yuki', minutesAgo: 300, x: 0.45, y: 0.65,
    title: '水源补给', note: '干净山泉水，可直接饮用，旁边有平地休息', distanceM: 2800, timeAgo: '5小时前',
  },
];
