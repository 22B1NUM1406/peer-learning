// Түвшин (санал 4). Онооноос тооцогдох тул тусдаа хадгалахгүй: оноо өөрчлөгдөхөд түвшин дагаад өөрчлөгдөнө.
// Босго: 10 оноо ≈ нэг "тусалсан" хариулт, 50 ≈ тав, 200 ≈ хорь.
export const LEVELS = [
  { key: 'newcomer', name: 'Шинэ гишүүн', min: 0 },
  { key: 'helper', name: 'Туслагч', min: 10 },
  { key: 'active', name: 'Идэвхтэй туслагч', min: 50 },
  { key: 'expert', name: 'Мэргэжилтэн', min: 200 },
];

export function levelFor(reputation = 0) {
  let i = 0;
  while (i + 1 < LEVELS.length && reputation >= LEVELS[i + 1].min) i += 1;
  const next = LEVELS[i + 1];
  return { key: LEVELS[i].key, name: LEVELS[i].name, nextName: next?.name ?? null, nextAt: next?.min ?? null };
}
