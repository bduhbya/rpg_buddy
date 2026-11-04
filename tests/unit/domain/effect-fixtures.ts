export const multiplyEffect = (target = 'strengthBonus', factor: unknown = 2) => ({
  op: 'multiply',
  target,
  factor,
});
export const entryFixture = (effects: unknown = [multiplyEffect()], id = 'custom-trait') => ({
  id,
  category: 'custom',
  label: 'Informational name',
  description: '',
  effects,
});
