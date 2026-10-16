import type { AvailabilitySlot } from '@/features/auth/authStore';

export const WEEKDAYS = [
  { value: 1, short: 'Lun', label: 'Lunes' },
  { value: 2, short: 'Mar', label: 'Martes' },
  { value: 3, short: 'Mié', label: 'Miércoles' },
  { value: 4, short: 'Jue', label: 'Jueves' },
  { value: 5, short: 'Vie', label: 'Viernes' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
];

export const TIME_BLOCKS = [
  { label: 'Mañana', start: '07:00', end: '11:00' },
  { label: 'Mediodía', start: '11:00', end: '15:00' },
  { label: 'Tarde', start: '15:00', end: '19:00' },
  { label: 'Noche', start: '19:00', end: '22:00' },
];

export const blockKey = (weekday: number, blockIndex: number) => `${weekday}-${blockIndex}`;

/** Convierte bloques marcados en franjas, uniendo bloques seguidos del mismo día. */
export function blocksToSlots(keys: Set<string>): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  for (const day of WEEKDAYS) {
    let current: AvailabilitySlot | null = null;
    TIME_BLOCKS.forEach((block, i) => {
      if (keys.has(blockKey(day.value, i))) {
        if (current && current.end === block.start) current.end = block.end;
        else {
          current = { weekday: day.value, start: block.start, end: block.end };
          slots.push(current);
        }
      } else {
        current = null;
      }
    });
  }
  return slots;
}

/** Marca los bloques que caen dentro de las franjas guardadas. */
export function slotsToBlocks(slots: AvailabilitySlot[]): Set<string> {
  const keys = new Set<string>();
  for (const s of slots) {
    TIME_BLOCKS.forEach((block, i) => {
      if (s.start <= block.start && s.end >= block.end) keys.add(blockKey(s.weekday, i));
    });
  }
  return keys;
}
