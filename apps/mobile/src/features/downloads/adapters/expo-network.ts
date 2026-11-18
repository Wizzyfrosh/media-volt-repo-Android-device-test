import * as Network from 'expo-network';
import type { NetworkKind, NetworkPort } from '../ports';

function toKind(state: Network.NetworkState): NetworkKind {
  if (state.isConnected === false) return 'offline';
  switch (state.type) {
    case Network.NetworkStateType.WIFI:
    case Network.NetworkStateType.ETHERNET:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'cellular';
    case Network.NetworkStateType.NONE:
      return 'offline';
    default:
      return 'other';
  }
}

export function createExpoNetwork(): NetworkPort {
  return {
    getKind: async () => toKind(await Network.getNetworkStateAsync()),
    subscribe: (listener) => {
      const sub = Network.addNetworkStateListener((state) => listener(toKind(state)));
      return () => sub.remove();
    },
  };
}
