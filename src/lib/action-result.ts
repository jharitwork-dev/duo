// Result shape for server actions whose expected (business) errors the user must read.
// Production builds redact thrown error messages, so expected errors are returned, not thrown.
// Authorization failures still throw.
export type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

export function actionError(error: string): { success: false; error: string } {
  return { success: false, error };
}
