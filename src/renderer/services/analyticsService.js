/**
 * Analytics stub. Can be wired to a real provider later.
 */
export const analyticsService = {
  track(eventName, properties = {}) {
    if (import.meta.env.DEV) {
      console.debug('[analytics]', eventName, properties);
    }
  },

  identify(userId, traits = {}) {
    if (import.meta.env.DEV) {
      console.debug('[analytics] identify', userId, traits);
    }
  }
};
