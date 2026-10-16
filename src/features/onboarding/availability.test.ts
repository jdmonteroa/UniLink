import { describe, it, expect } from 'vitest';
import { blocksToSlots, slotsToBlocks, blockKey } from './availability';

describe('Horario libre', () => {
  it('une bloques seguidos del mismo día en una sola franja', () => {
    const keys = new Set([blockKey(2, 1), blockKey(2, 2), blockKey(4, 0)]);
    expect(blocksToSlots(keys)).toEqual([
      { weekday: 2, start: '11:00', end: '19:00' },
      { weekday: 4, start: '07:00', end: '11:00' },
    ]);
  });

  it('separa bloques no consecutivos', () => {
    const keys = new Set([blockKey(1, 0), blockKey(1, 2)]);
    expect(blocksToSlots(keys)).toHaveLength(2);
  });

  it('ida y vuelta conserva la selección', () => {
    const keys = new Set([blockKey(3, 1), blockKey(3, 2), blockKey(6, 3)]);
    expect(slotsToBlocks(blocksToSlots(keys))).toEqual(keys);
  });
});
