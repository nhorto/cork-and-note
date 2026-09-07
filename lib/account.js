// lib/account.js — account lifecycle actions.
import { supabase } from './supabase';

export const accountService = {
  // Permanently delete the signed-in user's account: photos, database rows,
  // and the auth user itself, via the delete-account Edge Function (#161).
  // Resolves on success; throws with a user-presentable message on failure.
  async deleteAccount() {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      // functions.invoke surfaces non-2xx as a FunctionsHttpError whose .message
      // is generic; the function's friendly JSON body is only on error.context.
      let serverMessage = null;
      try {
        const bodyJson = await error.context?.json?.();
        serverMessage = bodyJson?.error || null;
      } catch {
        // body wasn't JSON / already consumed — fall through to the generic message
      }
      console.error('Account deletion error:', serverMessage || error.message);
      throw new Error(serverMessage || 'Account deletion failed. Please try again.');
    }

    if (data?.error) {
      console.error('Account deletion error:', data.error);
      throw new Error(data.error);
    }
  },
};
