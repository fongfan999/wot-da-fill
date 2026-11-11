/**
 * An error whose message is already written for the person, in their language: say it as it is.
 * Anything else (a failed download, a library's own error) is for the console; the person gets
 * the caller's plain fallback instead.
 */
export class UserError extends Error {}

export function messageOf(err: unknown, fallback: string): string {
	return err instanceof UserError ? err.message : fallback;
}
