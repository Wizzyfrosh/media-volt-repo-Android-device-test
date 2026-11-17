// Native modules that are not available in Jest.
jest.mock('expo-sqlite/kv-store', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (k: string) => data.get(k) ?? null,
      setItemSync: (k: string, v: string) => void data.set(k, v),
      removeItemSync: (k: string) => void data.delete(k),
      getItem: async (k: string) => data.get(k) ?? null,
      setItem: async (k: string, v: string) => void data.set(k, v),
      removeItem: async (k: string) => void data.delete(k),
    },
  };
});

jest.mock('expo-clipboard', () => ({
  hasUrlAsync: jest.fn(async () => false),
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
}));

// lucide-react-native ships ESM only. Icons render as empty components in tests.
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return new Proxy(
    { __esModule: true },
    { get: (target, name) => (name in target ? target[name as keyof typeof target] : Icon) },
  );
});
