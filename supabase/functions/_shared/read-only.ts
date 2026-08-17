/** True when auth app_metadata.read_only is set (demo / locked accounts). */
export function isReadOnlyAccount(user: {
  app_metadata?: Record<string, unknown> | null;
}): boolean {
  return user.app_metadata?.read_only === true || user.app_metadata?.read_only === "true";
}
