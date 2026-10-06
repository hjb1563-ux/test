// MVP: temporarily hide guide entry points; preserve the existing implementation.
// Before restoring, confirm placement with the user if the original slot has changed.
export const FEATURE_FLAGS = {
  remodelingGuide: false,
} as const;
